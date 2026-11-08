/**
 * Pruebas de la calificación del servicio (US-016). La red se simula con
 * `spyOn`; cada prueba mapea a un escenario de aceptación.
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
import CalificacionForm, {
  LIMITE_RESENA,
  MENSAJE_ERROR_CALIFICAR,
  MENSAJE_ERROR_FORMULARIO,
  MENSAJE_FALTAN_ESTRELLAS,
  MENSAJE_GRACIAS,
  MENSAJE_SIN_TAREA,
  MENSAJE_YA_CALIFICASTE,
} from './CalificacionForm';

const TAREA = '33333333-3333-4333-8333-333333333333';

const formulario = (
  cambios: Partial<api.FormularioCalificacionApi> = {}
): api.FormularioCalificacionApi => ({
  tareaId: TAREA,
  titulo: 'Arreglar grifo',
  afiliado: { id: 'a-1', nombre: 'José Ríos' },
  yaCalificada: false,
  ...cambios,
});

let nav: ReturnType<typeof simularNavegacion>;

beforeEach(() => {
  resetSesion();
  nav = simularNavegacion(`?tarea=${TAREA}`);
});

afterEach(() => {
  cleanup();
  nav.restaurar();
  spyOn(api, 'obtenerFormularioCalificacion').mockRestore();
  spyOn(api, 'crearCalificacion').mockRestore();
});

const estrellas = (n: number) =>
  fireEvent.click(
    screen.getByRole('radio', {
      name: `${n} ${n === 1 ? 'estrella' : 'estrellas'}`,
    })
  );
const enviar = () =>
  fireEvent.click(
    screen.getByRole('button', { name: /Enviar calificación|Enviando/ })
  );

async function abrir(cambios: Partial<api.FormularioCalificacionApi> = {}) {
  const cargar = spyOn(api, 'obtenerFormularioCalificacion').mockResolvedValue(
    formulario(cambios)
  );
  render(<CalificacionForm />);
  await screen.findByRole('heading', { name: 'Califica el servicio' });
  return cargar;
}

describe('CalificacionForm', () => {
  test('Esc 1: con estrellas y reseña envía, agradece y enlaza al perfil del afiliado', async () => {
    // Given: el formulario de una tarea finalizada
    const cargar = await abrir();
    const crear = spyOn(api, 'crearCalificacion').mockResolvedValue(
      {} as api.CalificacionApi
    );
    expect(cargar).toHaveBeenCalledWith('token-falso', TAREA);
    expect(screen.getByText(/José Ríos realizó «Arreglar grifo»/)).toBeTruthy();
    // When: elige 5 estrellas, escribe la reseña y envía
    estrellas(5);
    fireEvent.change(screen.getByLabelText(/Reseña/), {
      target: { value: 'Excelente trabajo' },
    });
    enviar();
    // Then: agradecimiento y enlace al perfil del afiliado calificado
    expect((await screen.findByRole('status')).textContent).toBe(
      MENSAJE_GRACIAS
    );
    expect(
      screen
        .getByRole('link', { name: /Ver el perfil de José Ríos/ })
        .getAttribute('href')
    ).toBe('/perfil/publico?id=a-1');
    expect(crear).toHaveBeenCalledWith({
      token: 'token-falso',
      tareaId: TAREA,
      puntuacion: 5,
      comentario: 'Excelente trabajo',
    });
  });

  test('Esc 2: la reseña es opcional', async () => {
    // Given: el formulario y un backend que guarda
    await abrir();
    const crear = spyOn(api, 'crearCalificacion').mockResolvedValue(
      {} as api.CalificacionApi
    );
    // When: elige estrellas y envía sin escribir nada
    estrellas(4);
    enviar();
    // Then: se guarda sin obligar a escribir texto
    expect((await screen.findByRole('status')).textContent).toBe(
      MENSAJE_GRACIAS
    );
    expect(crear).toHaveBeenCalledWith(
      expect.objectContaining({ puntuacion: 4, comentario: '' })
    );
  });

  test('Esc 3: sin estrellas no envía y resalta la sección con el mensaje', async () => {
    // Given: el formulario con un comentario pero sin estrellas
    await abrir();
    const crear = spyOn(api, 'crearCalificacion');
    fireEvent.change(screen.getByLabelText(/Reseña/), {
      target: { value: 'Buen trabajo' },
    });
    // When: envía
    enviar();
    // Then: se detiene, se resalta y se muestra el mensaje exacto
    expect((await screen.findByRole('alert')).textContent).toBe(
      MENSAJE_FALTAN_ESTRELLAS
    );
    expect(screen.getByRole('radiogroup').className).toContain(
      'ch-estrellas-input--error'
    );
    expect(crear).not.toHaveBeenCalled();
    // When: elige estrellas
    estrellas(3);
    // Then: el aviso desaparece
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('Esc 4: la reseña no admite más del límite y muestra el contador', async () => {
    // Given: el formulario
    await abrir();
    const caja = screen.getByLabelText(/Reseña/) as HTMLTextAreaElement;
    // Then: el campo bloquea la entrada en el límite
    expect(caja.maxLength).toBe(LIMITE_RESENA);
    expect(screen.getByText(`0/${LIMITE_RESENA}`)).toBeTruthy();
    // When: escribe algo
    fireEvent.change(caja, { target: { value: 'Hola' } });
    // Then: el contador avanza
    expect(screen.getByText(`4/${LIMITE_RESENA}`)).toBeTruthy();
  });

  test('Esc 5: si ya calificó, el formulario se bloquea con el mensaje de la historia', async () => {
    // Given: una tarea ya calificada
    spyOn(api, 'obtenerFormularioCalificacion').mockResolvedValue(
      formulario({ yaCalificada: true })
    );
    // When: abre la URL del formulario
    render(<CalificacionForm />);
    // Then: mensaje y sin formulario
    expect(await screen.findByText(MENSAJE_YA_CALIFICASTE)).toBeTruthy();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(
      screen.queryByRole('button', { name: /Enviar calificación/ })
    ).toBeNull();
  });

  test('Esc 5: si el envío revela que ya estaba calificada, bloquea el formulario', async () => {
    // Given: el formulario y un backend que dice que ya existe la valoración
    await abrir();
    spyOn(api, 'crearCalificacion').mockRejectedValue(
      new api.ErrorYaCalificada()
    );
    // When: envía
    estrellas(5);
    enviar();
    // Then: pasa a la pantalla de ya calificada
    expect((await screen.findByRole('status')).textContent).toBe(
      MENSAJE_YA_CALIFICASTE
    );
  });

  test('Esc 6: "Calificar más tarde" vuelve a Mis solicitudes sin enviar nada', async () => {
    // Given: el formulario
    await abrir();
    const crear = spyOn(api, 'crearCalificacion');
    // Then: el enlace lleva a Mis solicitudes (donde queda la calificación pendiente)
    expect(
      screen
        .getByRole('link', { name: 'Calificar más tarde' })
        .getAttribute('href')
    ).toBe('/tareas/mias');
    expect(crear).not.toHaveBeenCalled();
  });

  test('un fallo de conexión al enviar avisa y permite reintentar; evita el doble envío', async () => {
    // Given: un backend lento que luego falla por red
    await abrir();
    let rechazar: (e: Error) => void = () => {};
    const crear = spyOn(api, 'crearCalificacion').mockReturnValue(
      new Promise((_, r) => {
        rechazar = r;
      })
    );
    estrellas(5);
    const formularioDom = screen
      .getByRole('button', { name: 'Enviar calificación' })
      .closest('form')!;
    // When: se envía dos veces seguidas
    fireEvent.submit(formularioDom);
    fireEvent.submit(formularioDom);
    // Then: una sola petición y el botón en "Enviando…"
    expect(crear).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Enviando…' })).toBeTruthy();
    // When: falla la conexión
    rechazar(new api.ErrorSinConexion());
    // Then: aviso de conexión y el formulario sigue disponible
    expect((await screen.findByRole('alert')).textContent).toBe(
      MENSAJE_ERROR_CALIFICAR
    );
    expect(
      (
        screen.getByRole('button', {
          name: 'Enviar calificación',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false);
    // When: se recupera y reintenta
    crear.mockResolvedValue({} as api.CalificacionApi);
    enviar();
    // Then: se envía
    expect((await screen.findByRole('status')).textContent).toBe(
      MENSAJE_GRACIAS
    );
  });

  test('un rechazo de negocio muestra su explicación; un valor raro, el mensaje genérico', async () => {
    // Given: el formulario y un backend que rechaza con explicación
    await abrir();
    const crear = spyOn(api, 'crearCalificacion').mockRejectedValue(
      new Error('Solo puedes calificar una tarea finalizada.')
    );
    estrellas(2);
    // When: envía
    enviar();
    // Then: muestra la explicación del backend
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Solo puedes calificar'
    );
    // Given: ahora un rechazo que no es Error
    crear.mockRejectedValue('boom');
    // When: reintenta
    enviar();
    // Then: mensaje genérico
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        MENSAJE_ERROR_CALIFICAR
      )
    );
  });

  test('sin tarea en la URL, o si no se puede leer, explica que no la encontró', async () => {
    // Given: una URL sin ?tarea=
    nav.restaurar();
    nav = simularNavegacion('');
    const cargar = spyOn(api, 'obtenerFormularioCalificacion');
    const { unmount } = render(<CalificacionForm />);
    // Then: mensaje sin consultar el backend
    expect((await screen.findByRole('alert')).textContent).toBe(
      MENSAJE_SIN_TAREA
    );
    expect(cargar).not.toHaveBeenCalled();
    unmount();
    // Given: una página cuya URL no se puede leer
    nav.restaurar();
    const original = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      configurable: true,
      get() {
        throw new Error('sin acceso');
      },
    });
    try {
      // When: se abre
      render(<CalificacionForm />);
      // Then: también no la encuentra
      expect((await screen.findByRole('alert')).textContent).toBe(
        MENSAJE_SIN_TAREA
      );
    } finally {
      if (original) Object.defineProperty(window, 'location', original);
    }
  });

  test('si el backend no permite calificar (no eres el creador, no está finalizada) muestra su mensaje', async () => {
    // Given: un backend que responde 403 con explicación
    spyOn(api, 'obtenerFormularioCalificacion').mockRejectedValue(
      new Error('Solo el creador de la tarea puede calificar el servicio.')
    );
    // When: se abre
    render(<CalificacionForm />);
    // Then: alerta con el mensaje y salida a Mis solicitudes
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Solo el creador'
    );
    expect(
      screen.getByRole('link', { name: 'Ir a mis solicitudes' })
    ).toBeTruthy();
  });

  test('un fallo de red al cargar permite reintentar', async () => {
    // Given: un backend que falla la primera vez
    const cargar = spyOn(
      api,
      'obtenerFormularioCalificacion'
    ).mockRejectedValueOnce(new api.ErrorSinConexion());
    render(<CalificacionForm />);
    // When: falla la carga
    expect((await screen.findByRole('alert')).textContent).toContain(
      MENSAJE_ERROR_FORMULARIO
    );
    // When: se recupera y se reintenta
    cargar.mockResolvedValue(formulario());
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/i }));
    // Then: aparece el formulario
    expect(
      await screen.findByRole('heading', { name: 'Califica el servicio' })
    ).toBeTruthy();
    // Given: un rechazo que no es Error
    cleanup();
    cargar.mockRejectedValue('boom');
    render(<CalificacionForm />);
    // Then: también el aviso de conexión
    expect((await screen.findByRole('alert')).textContent).toContain(
      MENSAJE_ERROR_FORMULARIO
    );
  });

  test('sin sesión invita a iniciar sesión; expirada redirige al login', async () => {
    // Given: no hay token
    localStorage.removeItem('ch-token');
    const cargar = spyOn(api, 'obtenerFormularioCalificacion');
    const { unmount } = render(<CalificacionForm />);
    // Then: invita a iniciar sesión sin pedir nada
    expect(
      await screen.findByRole('link', { name: /Iniciar sesión/i })
    ).toBeTruthy();
    expect(cargar).not.toHaveBeenCalled();
    unmount();
    // Given: un backend que responde 401
    resetSesion();
    cargar.mockRejectedValue(new api.ErrorSesionExpirada());
    // When: se abre
    render(<CalificacionForm />);
    // Then: redirige a /login?expirada=1
    await waitFor(() => expect(nav.destino()).toBe('/login?expirada=1'));
  });

  test('si el token desaparece al enviar, redirige al login; y 401 al enviar también', async () => {
    // Given: el formulario y un backend que responde 401 al enviar
    await abrir();
    const crear = spyOn(api, 'crearCalificacion').mockRejectedValue(
      new api.ErrorSesionExpirada()
    );
    estrellas(5);
    // When: envía
    enviar();
    // Then: redirige a /login?expirada=1
    await waitFor(() => expect(nav.destino()).toBe('/login?expirada=1'));
    // Given: ahora sin token
    nav.restaurar();
    nav = simularNavegacion(`?tarea=${TAREA}`);
    localStorage.removeItem('ch-token');
    crear.mockClear();
    // When: envía de nuevo
    estrellas(5);
    enviar();
    // Then: redirige igual sin llamar al backend
    await waitFor(() => expect(nav.destino()).toBe('/login?expirada=1'));
    expect(crear).not.toHaveBeenCalled();
  });
});
