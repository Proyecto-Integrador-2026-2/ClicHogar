/**
 * Pruebas de "Mis solicitudes" (US-012): lista con el número de ofertas,
 * estado vacío, error con reintento y sesión.
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
import MisSolicitudes, {
  MENSAJE_CALIFICACION_PENDIENTE,
  MENSAJE_ERROR_SOLICITUDES,
  MENSAJE_SIN_SOLICITUDES,
  textoOfertas,
} from './MisSolicitudes';

const tarea = (
  id: string,
  totalOfertas: number,
  estado = 'abierta',
  calificacionPendiente = false
): api.TareaPropiaApi => ({
  id,
  titulo: `Tarea ${id}`,
  descripcion: 'Descripción de la tarea de prueba.',
  categoria: 'Limpieza',
  estado,
  ubicacion: 'Envigado',
  latitud: null,
  longitud: null,
  autorId: 'u-1',
  autorNombre: 'Ana',
  creadoEn: '2026-03-15T12:00:00.000Z',
  totalOfertas,
  calificacionPendiente,
});

let nav: ReturnType<typeof simularNavegacion>;

beforeEach(() => {
  resetSesion();
  nav = simularNavegacion();
});

afterEach(() => {
  cleanup();
  nav.restaurar();
  spyOn(api, 'listarMisTareas').mockRestore();
});

describe('textoOfertas', () => {
  test('cero, una y varias', () => {
    // Given: distintos totales
    // When / Then: singular, plural y vacío
    expect(textoOfertas(0)).toBe('Sin ofertas');
    expect(textoOfertas(1)).toBe('1 oferta');
    expect(textoOfertas(3)).toBe('3 ofertas');
  });
});

describe('MisSolicitudes', () => {
  test('Esc 1: lista las tareas con sus ofertas y un acceso al detalle', async () => {
    // Given: dos tareas propias, una abierta con 2 ofertas y otra asignada
    spyOn(api, 'listarMisTareas').mockResolvedValue([
      tarea('t-1', 2),
      tarea('t-2', 0, 'asignada'),
    ]);
    // When: se abre la página
    render(<MisSolicitudes />);
    // Then: se ve cada tarea con su estado y su número de ofertas
    expect(await screen.findByText('Tarea t-1')).toBeTruthy();
    expect(screen.getByText('2 ofertas')).toBeTruthy();
    expect(screen.getByText('Sin ofertas')).toBeTruthy();
    expect(screen.getByText('Abierta')).toBeTruthy();
    expect(screen.getByText('asignada')).toBeTruthy();
    // Then: cada una enlaza a su detalle, donde están las ofertas
    expect(
      screen
        .getAllByRole('link', { name: 'Ver ofertas' })
        .map((a) => a.getAttribute('href'))
    ).toEqual(['/tareas/detalle?id=t-1', '/tareas/detalle?id=t-2']);
  });

  test('US-016 Esc 6: una tarea finalizada sin calificar muestra la calificación pendiente', async () => {
    // Given: una tarea finalizada sin calificar y otra ya calificada
    spyOn(api, 'listarMisTareas').mockResolvedValue([
      tarea('t-1', 1, 'finalizada', true),
      tarea('t-2', 1, 'finalizada', false),
    ]);
    // When: se abre la página
    render(<MisSolicitudes />);
    await screen.findByText('Tarea t-1');
    // Then: solo la pendiente muestra el aviso, con un enlace para retomarla
    expect(
      screen.getAllByText(MENSAJE_CALIFICACION_PENDIENTE, { exact: false })
    ).toHaveLength(1);
    expect(
      screen.getByRole('link', { name: 'Calificar ahora' }).getAttribute('href')
    ).toBe('/calificaciones?tarea=t-1');
  });

  test('sin solicitudes invita a publicar la primera', async () => {
    // Given: un usuario sin tareas
    spyOn(api, 'listarMisTareas').mockResolvedValue([]);
    // When: se abre la página
    render(<MisSolicitudes />);
    // Then: mensaje y enlace para publicar
    expect(await screen.findByText(MENSAJE_SIN_SOLICITUDES)).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: 'Publicar una tarea' })
        .getAttribute('href')
    ).toBe('/tareas/nueva');
  });

  test('muestra "Cargando" mientras llegan los datos', () => {
    // Given: un backend que no responde todavía
    spyOn(api, 'listarMisTareas').mockReturnValue(new Promise(() => {}));
    // When: se abre la página
    render(<MisSolicitudes />);
    // Then: indica que carga
    expect(screen.getByRole('status').textContent).toContain('Cargando');
  });

  test('un fallo de red muestra el mensaje y permite reintentar', async () => {
    // Given: un backend que falla la primera vez
    const listar = spyOn(api, 'listarMisTareas').mockRejectedValueOnce(
      new Error('offline')
    );
    render(<MisSolicitudes />);
    // When: falla la carga
    expect((await screen.findByRole('alert')).textContent).toContain(
      MENSAJE_ERROR_SOLICITUDES
    );
    // When: se recupera y se reintenta
    listar.mockResolvedValue([tarea('t-1', 1)]);
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/i }));
    // Then: se muestra la lista
    expect(await screen.findByText('Tarea t-1')).toBeTruthy();
  });

  test('sin sesión invita a iniciar sesión y no llama al backend', async () => {
    // Given: no hay token
    localStorage.removeItem('ch-token');
    const listar = spyOn(api, 'listarMisTareas');
    // When: se abre la página
    render(<MisSolicitudes />);
    // Then: invita a iniciar sesión
    expect(
      await screen.findByRole('link', { name: /Iniciar sesión/i })
    ).toBeTruthy();
    expect(listar).not.toHaveBeenCalled();
  });

  test('una sesión expirada redirige al login', async () => {
    // Given: un backend que responde 401
    spyOn(api, 'listarMisTareas').mockRejectedValue(
      new api.ErrorSesionExpirada()
    );
    // When: se abre la página
    render(<MisSolicitudes />);
    // Then: redirige a /login?expirada=1
    await waitFor(() => expect(nav.destino()).toBe('/login?expirada=1'));
  });

  test('si el token desaparece antes de reintentar, redirige al login', async () => {
    // Given: una primera carga fallida y luego se pierde el token
    spyOn(api, 'listarMisTareas').mockRejectedValue(new Error('caída'));
    render(<MisSolicitudes />);
    await screen.findByRole('alert');
    localStorage.removeItem('ch-token');
    // When: se reintenta
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/i }));
    // Then: sin token se pide iniciar sesión
    expect(
      await screen.findByRole('link', { name: /Iniciar sesión/i })
    ).toBeTruthy();
  });
});
