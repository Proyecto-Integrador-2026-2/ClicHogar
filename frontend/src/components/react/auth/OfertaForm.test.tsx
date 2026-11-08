/**
 * Pruebas del formulario de oferta (US-011). `enviarOferta` se simula; cada
 * prueba mapea a un escenario de aceptación.
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import React from 'react';
import { resetSesion, simularNavegacion } from '../../../../test-setup';
import * as api from '../../../lib/usuarios-api';
import OfertaForm, {
  LIMITE_MENSAJE_OFERTA,
  MENSAJE_ERROR_OFERTA,
} from './OfertaForm';

let nav: ReturnType<typeof simularNavegacion>;

const OFERTA = {} as api.OfertaApi;

function montar(props: Partial<React.ComponentProps<typeof OfertaForm>> = {}) {
  const llamadas = { enviada: 0, yaPostulado: 0, noAcepta: 0 };
  render(
    <OfertaForm
      tareaId="t-1"
      onEnviada={() => llamadas.enviada++}
      onYaPostulado={() => llamadas.yaPostulado++}
      onNoAcepta={() => llamadas.noAcepta++}
      {...props}
    />
  );
  return llamadas;
}

const abrir = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Enviar oferta' }));
const confirmar = () =>
  fireEvent.click(
    screen.getByRole('button', { name: /Confirmar postulación|Enviando/ })
  );

beforeEach(() => {
  resetSesion();
  nav = simularNavegacion();
});

afterEach(() => {
  cleanup();
  nav.restaurar();
  spyOn(api, 'enviarOferta').mockRestore();
});

describe('OfertaForm', () => {
  test('arranca cerrado; abre el formulario y se puede cancelar', () => {
    // Given: el formulario recién montado
    montar();
    // Then: solo se ve el botón de ofertar
    expect(screen.queryByLabelText(/Mensaje para el creador/)).toBeNull();
    // When: se abre
    abrir();
    // Then: aparece el mensaje opcional con su contador
    expect(screen.getByLabelText(/Mensaje para el creador/)).toBeTruthy();
    expect(screen.getByText(`0/${LIMITE_MENSAJE_OFERTA}`)).toBeTruthy();
    // When: se cancela
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    // Then: vuelve al botón inicial
    expect(screen.getByRole('button', { name: 'Enviar oferta' })).toBeTruthy();
  });

  test('Esc 1: envía la oferta sin mensaje (es opcional)', async () => {
    // Given: un backend que acepta la oferta
    const enviar = spyOn(api, 'enviarOferta').mockResolvedValue(OFERTA);
    const llamadas = montar();
    abrir();
    // When: confirma sin escribir nada
    confirmar();
    // Then: se envía con mensaje vacío y se avisa al padre
    await waitFor(() => expect(llamadas.enviada).toBe(1));
    expect(enviar).toHaveBeenCalledWith('token-falso', 't-1', '');
  });

  test('Esc 2: envía el mensaje escrito y cuenta los caracteres', async () => {
    // Given: un backend que acepta la oferta
    const enviar = spyOn(api, 'enviarOferta').mockResolvedValue(OFERTA);
    const llamadas = montar();
    abrir();
    // When: escribe una propuesta y confirma
    fireEvent.change(screen.getByLabelText(/Mensaje para el creador/), {
      target: { value: 'Tengo experiencia previa' },
    });
    expect(screen.getByText(`24/${LIMITE_MENSAJE_OFERTA}`)).toBeTruthy();
    confirmar();
    // Then: viaja el mensaje
    await waitFor(() => expect(llamadas.enviada).toBe(1));
    expect(enviar).toHaveBeenCalledWith(
      'token-falso',
      't-1',
      'Tengo experiencia previa'
    );
  });

  test('Esc 6: durante el envío deshabilita el formulario y evita duplicados', async () => {
    // Given: un backend lento y un formulario abierto
    let resolver: (o: api.OfertaApi) => void = () => {};
    const enviar = spyOn(api, 'enviarOferta').mockReturnValue(
      new Promise((r) => {
        resolver = r;
      })
    );
    const llamadas = montar();
    abrir();
    const formulario = screen
      .getByRole('button', { name: 'Confirmar postulación' })
      .closest('form')!;
    // When: se envía dos veces seguidas (doble clic)
    fireEvent.submit(formulario);
    fireEvent.submit(formulario);
    // Then: solo sale una petición y los controles quedan bloqueados
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(
      (screen.getByRole('button', { name: 'Enviando…' }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    // When: termina
    resolver(OFERTA);
    // Then: se avisa una sola vez
    await waitFor(() => expect(llamadas.enviada).toBe(1));
  });

  test('Esc 6: un fallo de red detiene la carga, avisa y el aviso es temporal', async () => {
    // Given: un backend que no responde (error de red)
    const enviar = spyOn(api, 'enviarOferta').mockRejectedValue(
      new Error('offline')
    );
    const llamadas = montar({ duracionErrorMs: 50 });
    abrir();
    // When: confirma
    confirmar();
    // Then: muestra el mensaje de conexión y el botón vuelve a estar disponible
    expect((await screen.findByRole('alert')).textContent).toBe(
      MENSAJE_ERROR_OFERTA
    );
    expect(
      (
        screen.getByRole('button', {
          name: 'Confirmar postulación',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false);
    expect(llamadas.enviada).toBe(0);
    // Then: el aviso desaparece solo
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByRole('alert')).toBeNull();
    // When: reintenta con el backend recuperado
    enviar.mockResolvedValue(OFERTA);
    confirmar();
    // Then: se envía
    await waitFor(() => expect(llamadas.enviada).toBe(1));
  });

  test('Esc 3: un 409 avisa al padre (ya postulado)', async () => {
    // Given: un backend que dice que ya existe la oferta
    spyOn(api, 'enviarOferta').mockRejectedValue(new api.ErrorYaPostulado());
    const llamadas = montar();
    abrir();
    // When: confirma
    confirmar();
    // Then: avisa que ya estaba postulado, sin éxito ni error de red
    await waitFor(() => expect(llamadas.yaPostulado).toBe(1));
    expect(llamadas.enviada).toBe(0);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('Esc 5: si la tarea ya no acepta ofertas, avisa al padre', async () => {
    // Given: una tarea que se cerró al confirmar
    spyOn(api, 'enviarOferta').mockRejectedValue(
      new api.ErrorTareaNoAceptaOfertas()
    );
    const llamadas = montar();
    abrir();
    // When: confirma
    confirmar();
    // Then: avisa al padre (que mostrará la alerta y redirigirá)
    await waitFor(() => expect(llamadas.noAcepta).toBe(1));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('sesión expirada o sin token: redirige al login', async () => {
    // Given: un backend que responde 401
    const enviar = spyOn(api, 'enviarOferta').mockRejectedValue(
      new api.ErrorSesionExpirada()
    );
    montar();
    abrir();
    // When: confirma
    confirmar();
    // Then: redirige a /login?expirada=1
    await waitFor(() => expect(nav.destino()).toBe('/login?expirada=1'));
    // Given: ahora sin token guardado
    nav.restaurar();
    nav = simularNavegacion();
    localStorage.removeItem('ch-token');
    // When: confirma otra vez
    confirmar();
    // Then: redirige igual y no llama al backend de nuevo
    await waitFor(() => expect(nav.destino()).toBe('/login?expirada=1'));
    expect(enviar).toHaveBeenCalledTimes(1);
  });
});
