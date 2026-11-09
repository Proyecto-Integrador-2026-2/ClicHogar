/**
 * Pruebas de "Mis ofertas" (`/dashboard/ofertas/mias`): los dos bloques
 * verticales, el ocultamiento de "Tareas aceptadas", los enlaces al perfil
 * y al detalle, y los estados vacío, error y sin sesión.
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import React from 'react';
import { resetSesion, simularNavegacion } from '../../../../test-setup';
import * as api from '../../../lib/usuarios-api';
import MisOfertas, {
  MENSAJE_SIN_TAREAS_PROPIAS,
} from './MisOfertas';

const tareaResumen = (
  id: string,
  cambios: Partial<api.TareaResumenOfertaApi> = {}
): api.TareaResumenOfertaApi => ({
  id,
  titulo: `Tarea ${id}`,
  descripcion: 'Descripción de la tarea de prueba.',
  categoria: 'Plomería',
  estado: 'abierta',
  ubicacion: 'Belén, Medellín',
  autorId: 'u-autor',
  autorNombre: 'Ana',
  creadoEn: '2026-03-15T12:00:00.000Z',
  ...cambios,
});

const ofertaRecibida = (
  id: string,
  cambios: Partial<api.OfertaRecibidaApi['afiliado']> = {},
  extra: Partial<api.OfertaRecibidaApi> = {}
): api.OfertaRecibidaApi => ({
  id,
  mensaje: `Propuesta de ${id}`,
  estado: 'pendiente',
  creadoEn: '2026-03-15T12:00:00.000Z',
  afiliado: {
    id: `a-${id}`,
    nombre: `Afiliado ${id}`,
    fotoUrl: null,
    descripcion: null,
    ubicacion: null,
    promedio: 4.5,
    totalCalificaciones: 2,
    ...cambios,
  },
  ...extra,
});

const ofertaAceptada = (id: string): api.OfertaApi => ({
  id,
  tareaId: 't-1',
  afiliadoId: 'a-1',
  mensaje: 'Quedo atento al horario.',
  estado: 'aceptada',
  creadoEn: '2026-03-15T12:00:00.000Z',
});

let nav: ReturnType<typeof simularNavegacion>;

beforeEach(() => {
  resetSesion();
  nav = simularNavegacion();
});

afterEach(() => {
  cleanup();
  nav.restaurar();
  spyOn(api, 'listarMisOfertas').mockRestore();
});

describe('MisOfertas', () => {
  test('muestra "Tareas aceptadas" con el cliente y el acceso al detalle', async () => {
    // Given: una tarea activa aceptada y ninguna tarea publicada
    spyOn(api, 'listarMisOfertas').mockResolvedValue({
      aceptadas: [
        {
          tarea: tareaResumen('t-1', { estado: 'asignada' }),
          oferta: ofertaAceptada('o-1'),
        },
      ],
      creadas: [],
    });
    // When: se abre la página
    render(<MisOfertas />);
    // Then: el bloque superior muestra la tarea, el cliente y su enlace
    const aceptadas = await screen.findByRole('region', {
      name: 'Tareas aceptadas',
    });
    expect(within(aceptadas).getByText('Tarea t-1')).toBeTruthy();
    expect(within(aceptadas).getByText('Cliente: Ana')).toBeTruthy();
    expect(within(aceptadas).getByText('Asignada')).toBeTruthy();
    expect(
      within(aceptadas)
        .getByRole('link', { name: 'Ver' })
        .getAttribute('href')
    ).toBe('/tareas/detalle?id=t-1');
  });

  test('oculta "Tareas aceptadas" cuando no hay ninguna activa', async () => {
    // Given: un usuario sin tareas aceptadas
    spyOn(api, 'listarMisOfertas').mockResolvedValue({
      aceptadas: [],
      creadas: [{ tarea: tareaResumen('t-2'), ofertas: [] }],
    });
    // When: se abre la página
    render(<MisOfertas />);
    await screen.findByRole('region', { name: 'Mis tareas publicadas' });
    // Then: el bloque superior no existe
    expect(
      screen.queryByRole('region', { name: 'Tareas aceptadas' })
    ).toBeNull();
  });

  test('lista cada tarea publicada con todas sus ofertas y enlaces', async () => {
    // Given: una tarea con dos ofertas (una con foto y otra sin reputación)
    spyOn(api, 'listarMisOfertas').mockResolvedValue({
      aceptadas: [],
      creadas: [
        {
          tarea: tareaResumen('t-2', { estado: 'asignada' }),
          ofertas: [
            ofertaRecibida('o-1', {
              fotoUrl: '/uploads/perfiles/a.jpg',
              promedio: 4.8,
            }),
            ofertaRecibida(
              'o-2',
              { promedio: null, totalCalificaciones: 0 },
              { estado: 'rechazada' }
            ),
          ],
        },
      ],
    });
    // When: se abre la página
    render(<MisOfertas />);
    const publicadas = await screen.findByRole('region', {
      name: 'Mis tareas publicadas',
    });
    // Then: se ve la tarea, su estado y el acceso al detalle
    expect(within(publicadas).getByText('Tarea t-2')).toBeTruthy();
    expect(within(publicadas).getByText('asignada')).toBeTruthy();
    expect(
      within(publicadas)
        .getByRole('link', { name: 'Ver tarea' })
        .getAttribute('href')
    ).toBe('/tareas/detalle?id=t-2');
    // Then: cada oferta muestra al afiliado, su reputación y su mensaje
    expect(
      within(publicadas).getByRole('heading', {
        level: 4,
        name: 'Afiliado o-1',
      })
    ).toBeTruthy();
    expect(
      within(publicadas).getByRole('img', {
        name: '4,8 de 5 estrellas, 2 calificaciones',
      })
    ).toBeTruthy();
    expect(within(publicadas).getByText('Sin calificaciones')).toBeTruthy();
    expect(
      within(publicadas).getByText('“Propuesta de o-1”')
    ).toBeTruthy();
    expect(within(publicadas).getByText('No seleccionado')).toBeTruthy();
    // Then: la foto y el nombre llevan al perfil público del afiliado
    expect(
      within(publicadas)
        .getAllByRole('link')
        .filter((enlace) =>
          enlace.getAttribute('href')?.startsWith('/perfil/publico')
        )
        .map((enlace) => enlace.getAttribute('href'))
    ).toEqual([
      '/perfil/publico?id=a-o-1',
      '/perfil/publico?id=a-o-1',
      '/perfil/publico?id=a-o-2',
      '/perfil/publico?id=a-o-2',
    ]);
  });

  test('sin tareas publicadas invita a publicar una', async () => {
    // Given: un usuario sin tareas propias ni aceptadas
    spyOn(api, 'listarMisOfertas').mockResolvedValue({
      aceptadas: [],
      creadas: [],
    });
    // When: se abre la página
    render(<MisOfertas />);
    // Then: aparece el estado vacío con el enlace para publicar
    expect(await screen.findByText(MENSAJE_SIN_TAREAS_PROPIAS)).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Publicar una tarea' }).getAttribute(
        'href'
      )
    ).toBe('/tareas/nueva');
  });

  test('si falla la carga muestra el aviso y reintenta', async () => {
    // Given: un backend que falla la primera vez
    const listar = spyOn(api, 'listarMisOfertas').mockRejectedValueOnce(
      new Error('sin conexión')
    );
    render(<MisOfertas />);
    // Then: se muestra el mensaje del error
    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toContain('sin conexión');
    // When: el backend se recupera y se pulsa Reintentar
    listar.mockResolvedValue({ aceptadas: [], creadas: [] });
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/i }));
    // Then: se carga el estado vacío
    expect(await screen.findByText(MENSAJE_SIN_TAREAS_PROPIAS)).toBeTruthy();
  });

  test('sin sesión invita a iniciar sesión y no llama al backend', () => {
    // Given: sin token
    localStorage.removeItem('ch-token');
    const listar = spyOn(api, 'listarMisOfertas');
    // When: se abre la página
    render(<MisOfertas />);
    // Then: se pide iniciar sesión y no hay petición
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toBeTruthy();
    expect(listar).not.toHaveBeenCalled();
  });
});
