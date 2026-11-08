/**
 * Pruebas del cierre de una tarea (US-014). `finalizarTarea` se simula; cada
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
import FinalizarTarea, {
  MENSAJE_ERROR_FINALIZAR,
  MENSAJE_FINALIZADA,
  hrefCalificar,
} from './FinalizarTarea';

let nav: ReturnType<typeof simularNavegacion>;

const RESULTADO: api.FinalizacionApi = {
  tareaId: 't-1',
  estado: 'finalizada',
  afiliadoId: 'a-1',
  finalizadaEn: '2026-03-01T00:00:00.000Z',
};

const montar = () =>
  render(<FinalizarTarea tareaId="t-1" nombreAfiliado="José" esperaMs={30} />);

const abrir = () =>
  fireEvent.click(
    screen.getByRole('button', { name: 'Marcar como finalizada' })
  );
const confirmar = () =>
  fireEvent.click(
    screen.getByRole('button', { name: /Confirmar pago y finalizar|Enviando/ })
  );

beforeEach(() => {
  resetSesion();
  nav = simularNavegacion();
});

afterEach(() => {
  cleanup();
  nav.restaurar();
  spyOn(api, 'finalizarTarea').mockRestore();
});

describe('FinalizarTarea', () => {
  test('hrefCalificar lleva al afiliado y la tarea', () => {
    // Given / When / Then: ids codificados
    expect(hrefCalificar('a 1', 't/1')).toBe(
      '/calificaciones?usuario=a%201&tarea=t%2F1'
    );
  });

  test('Esc 1: confirma el pago, felicita y lleva a calificar al afiliado', async () => {
    // Given: un backend que finaliza
    const finalizar = spyOn(api, 'finalizarTarea').mockResolvedValue(RESULTADO);
    montar();
    // When: abre la confirmación y confirma el pago
    abrir();
    expect(
      screen.getByText(/¿Ya realizaste el pago en efectivo a José\?/)
    ).toBeTruthy();
    confirmar();
    // Then: mensaje de éxito y, tras una pausa, redirección al formulario de calificación
    expect((await screen.findByRole('status')).textContent).toBe(
      MENSAJE_FINALIZADA
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(finalizar).toHaveBeenCalledWith('token-falso', 't-1');
    await waitFor(() =>
      expect(nav.destino()).toBe('/calificaciones?usuario=a-1&tarea=t-1')
    );
  });

  test('Esc 4: cancelar la confirmación deja todo intacto', () => {
    // Given: el diálogo abierto
    const finalizar = spyOn(api, 'finalizarTarea');
    montar();
    abrir();
    // When: cancela
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    // Then: no se llamó al backend y vuelve el botón inicial
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Marcar como finalizada' })
    ).toBeTruthy();
    expect(finalizar).not.toHaveBeenCalled();
    // When: lo abre otra vez y lo cierra con Escape
    abrir();
    fireEvent.keyDown(window, { key: 'Escape' });
    // Then: también queda intacta
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(finalizar).not.toHaveBeenCalled();
  });

  test('Esc 5: un fallo de conexión detiene la carga y no finaliza', async () => {
    // Given: un backend sin conexión
    const finalizar = spyOn(api, 'finalizarTarea').mockRejectedValue(
      new api.ErrorSinConexion()
    );
    montar();
    abrir();
    // When: confirma
    confirmar();
    // Then: alerta de la historia, botones libres y sin finalizar
    expect((await screen.findByRole('alert')).textContent).toBe(
      MENSAJE_ERROR_FINALIZAR
    );
    expect(
      (
        screen.getByRole('button', {
          name: 'Confirmar pago y finalizar',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false);
    expect(screen.queryByRole('status')).toBeNull();
    expect(nav.destino()).toBe('');
    // When: reintenta con el backend recuperado
    finalizar.mockResolvedValue(RESULTADO);
    confirmar();
    // Then: se completa
    expect((await screen.findByRole('status')).textContent).toBe(
      MENSAJE_FINALIZADA
    );
  });

  test('un rechazo de negocio muestra la explicación del backend; un valor raro, el mensaje genérico', async () => {
    // Given: un backend que rechaza con explicación
    const finalizar = spyOn(api, 'finalizarTarea').mockRejectedValue(
      new Error(
        'Solo se puede finalizar una tarea que ya tiene un afiliado asignado.'
      )
    );
    montar();
    abrir();
    // When: confirma
    confirmar();
    // Then: muestra el mensaje del backend
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Solo se puede finalizar'
    );
    // Given: ahora un rechazo que no es Error
    finalizar.mockRejectedValue('boom');
    // When: reintenta
    confirmar();
    // Then: mensaje genérico
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        MENSAJE_ERROR_FINALIZAR
      )
    );
  });

  test('evita enviar dos veces con clics repetidos', async () => {
    // Given: un backend lento
    let resolver: (r: api.FinalizacionApi) => void = () => {};
    const finalizar = spyOn(api, 'finalizarTarea').mockReturnValue(
      new Promise((r) => {
        resolver = r;
      })
    );
    montar();
    abrir();
    const boton = screen.getByRole('button', {
      name: 'Confirmar pago y finalizar',
    });
    // When: se hace clic dos veces seguidas
    fireEvent.click(boton);
    fireEvent.click(boton);
    // Then: solo sale una petición y el botón queda en "Enviando…"
    expect(finalizar).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Enviando…' })).toBeTruthy();
    // When: termina
    resolver(RESULTADO);
    // Then: se completa
    expect((await screen.findByRole('status')).textContent).toBe(
      MENSAJE_FINALIZADA
    );
  });

  test('sesión expirada o sin token: redirige al login', async () => {
    // Given: un backend que responde 401
    spyOn(api, 'finalizarTarea').mockRejectedValue(
      new api.ErrorSesionExpirada()
    );
    montar();
    abrir();
    // When: confirma
    confirmar();
    // Then: redirige a /login?expirada=1
    await waitFor(() => expect(nav.destino()).toBe('/login?expirada=1'));
    // Given: ahora sin token
    nav.restaurar();
    nav = simularNavegacion();
    localStorage.removeItem('ch-token');
    // When: confirma otra vez
    confirmar();
    // Then: redirige igual
    await waitFor(() => expect(nav.destino()).toBe('/login?expirada=1'));
  });
});
