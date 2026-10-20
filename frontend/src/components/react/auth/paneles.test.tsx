/**
 * Pruebas de DashboardPanel y TableroTareas: estados de carga, sin sesión,
 * datos, vacío, error con reintento y sesión expirada (redirect).
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
import { clerkFalso, resetClerkFalso } from '../../../../test-setup';
import * as api from '../../../lib/usuarios-api';
import DashboardPanel from './DashboardPanel';
import TableroTareas from './TableroTareas';

const PERFIL: api.UsuarioPublico = {
  id: 'u1',
  nombre: 'Ana Pérez',
  email: 'ana@ejemplo.com',
  rol: 'afiliado',
  fotoUrl: null,
  descripcion: 'Plomera',
  ubicacion: null,
  creadoEn: '2026-01-01T00:00:00Z',
};

const tarea = (
  id: string,
  estado = 'abierta',
  creadoEn = '2026-03-05T12:00:00Z'
) =>
  ({
    id,
    titulo: `Tarea ${id}`,
    descripcion: 'Desc',
    categoria: 'plomeria',
    estado,
    ubicacion: 'Envigado',
    autorNombre: 'Luis',
    creadoEn,
  }) satisfies api.TareaTablero;

const ubicacionOriginal = Object.getOwnPropertyDescriptor(window, 'location');
let destino = '';

beforeEach(() => {
  resetClerkFalso();
  destino = '';
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      set href(v: string) {
        destino = v;
      },
      get href() {
        return destino;
      },
    },
  });
});

afterEach(() => {
  cleanup();
  if (ubicacionOriginal)
    Object.defineProperty(window, 'location', ubicacionOriginal);
  spyOn(api, 'obtenerPerfil').mockRestore();
  spyOn(api, 'listarTareas').mockRestore();
});

describe('DashboardPanel', () => {
  test('muestra carga mientras Clerk no está listo', () => {
    clerkFalso.isLoaded = false;
    render(<DashboardPanel />);
    expect(screen.getByRole('status').textContent).toContain('Cargando');
  });

  test('sin sesión invita a iniciar sesión', async () => {
    clerkFalso.isSignedIn = false;
    render(<DashboardPanel />);
    expect(await screen.findByText('Iniciar sesión')).toBeTruthy();
  });

  test('con sesión muestra saludo, rol, perfil pendiente y tareas', async () => {
    spyOn(api, 'obtenerPerfil').mockResolvedValue(PERFIL);
    spyOn(api, 'listarTareas').mockResolvedValue([
      tarea('1'),
      tarea('2', 'cerrada'),
    ]);
    render(<DashboardPanel />);
    expect(await screen.findByText('Hola, Ana')).toBeTruthy();
    expect(screen.getByText(/resumen como Clic-Worker/)).toBeTruthy();
    expect(screen.getByText(/Falta: Foto, Ubicación/)).toBeTruthy();
    expect(screen.getByText('Explorar tablero')).toBeTruthy();
  });

  test('perfil completo muestra "Completo" y usa el nombre del perfil sin firstName', async () => {
    clerkFalso.user = { firstName: null, username: null };
    spyOn(api, 'obtenerPerfil').mockResolvedValue({
      ...PERFIL,
      rol: 'cliente',
      fotoUrl: '/f.jpg',
      ubicacion: 'Envigado',
    });
    spyOn(api, 'listarTareas').mockResolvedValue([]);
    render(<DashboardPanel />);
    expect(await screen.findByText('Hola, Ana Pérez')).toBeTruthy();
    expect(screen.getByText('Completo')).toBeTruthy();
    expect(screen.getByText(/resumen como Cliente/)).toBeTruthy();
  });

  test('sin firstName ni perfil cae en username y luego en "miembro"', async () => {
    clerkFalso.user = { firstName: null, username: 'ana99' };
    spyOn(api, 'obtenerPerfil').mockRejectedValue(new Error('Caído'));
    spyOn(api, 'listarTareas').mockResolvedValue([]);
    const { unmount } = render(<DashboardPanel />);
    expect(await screen.findByText('Hola, ana99')).toBeTruthy();
    unmount();

    clerkFalso.user = null;
    render(<DashboardPanel />);
    expect(await screen.findByText('Hola, miembro')).toBeTruthy();
    expect(screen.getByText('Este es tu resumen')).toBeTruthy();
  });

  test('error: alerta y reintento que recarga', async () => {
    const perfil = spyOn(api, 'obtenerPerfil').mockRejectedValueOnce(
      new Error('Sin servidor')
    );
    spyOn(api, 'listarTareas').mockResolvedValue([]);
    render(<DashboardPanel />);
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Sin servidor'
    );
    perfil.mockResolvedValue(PERFIL);
    fireEvent.click(screen.getByText('Reintentar'));
    expect(await screen.findByText(/resumen como Clic-Worker/)).toBeTruthy();
  });

  test('error que no es Error usa el mensaje genérico', async () => {
    spyOn(api, 'obtenerPerfil').mockRejectedValue('boom');
    spyOn(api, 'listarTareas').mockResolvedValue([]);
    render(<DashboardPanel />);
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo cargar tu panel.'
    );
  });

  test('sin token de sesión muestra el error correspondiente', async () => {
    clerkFalso.getToken = async () => null;
    render(<DashboardPanel />);
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo obtener la sesión'
    );
  });

  test('sesión expirada redirige al login', async () => {
    spyOn(api, 'obtenerPerfil').mockRejectedValue(
      new api.ErrorSesionExpirada()
    );
    spyOn(api, 'listarTareas').mockResolvedValue([]);
    render(<DashboardPanel />);
    await waitFor(() => expect(destino).toBe('/login?expirada=1'));
  });
});

describe('TableroTareas', () => {
  test('carga y sin sesión', async () => {
    clerkFalso.isLoaded = false;
    const { unmount } = render(<TableroTareas />);
    expect(screen.getByRole('status').textContent).toContain('Cargando');
    unmount();

    clerkFalso.isLoaded = true;
    clerkFalso.isSignedIn = false;
    render(<TableroTareas />);
    expect(await screen.findByText('Explora tareas')).toBeTruthy();
  });

  test('lista las tareas con fecha, y pluraliza el contador', async () => {
    spyOn(api, 'listarTareas').mockResolvedValue([
      tarea('1'),
      tarea('2', 'abierta', 'fecha-invalida'),
    ]);
    render(<TableroTareas />);
    expect(await screen.findByText('2 solicitudes activas')).toBeTruthy();
    expect(screen.getByText('Tarea 1')).toBeTruthy();
    expect(screen.getAllByText('Abierta')).toHaveLength(2);
    expect(screen.getAllByText(/Envigado · Luis/)).toHaveLength(2);
  });

  test('una sola tarea usa el singular', async () => {
    spyOn(api, 'listarTareas').mockResolvedValue([tarea('1')]);
    render(<TableroTareas />);
    expect(await screen.findByText('1 solicitud activa')).toBeTruthy();
  });

  test('tablero vacío', async () => {
    spyOn(api, 'listarTareas').mockResolvedValue([]);
    render(<TableroTareas />);
    expect(
      await screen.findByText('Aún no hay solicitudes abiertas')
    ).toBeTruthy();
    expect(screen.getByText(/No hay tareas abiertas por ahora/)).toBeTruthy();
  });

  test('error con reintento, error genérico y sin token', async () => {
    const lista = spyOn(api, 'listarTareas').mockRejectedValueOnce(
      new Error('Caído')
    );
    const { unmount } = render(<TableroTareas />);
    expect((await screen.findByRole('alert')).textContent).toContain('Caído');
    lista.mockResolvedValue([tarea('1')]);
    fireEvent.click(screen.getByText('Reintentar'));
    expect(await screen.findByText('Tarea 1')).toBeTruthy();
    unmount();

    lista.mockRejectedValue('boom');
    const segundo = render(<TableroTareas />);
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo cargar el tablero.'
    );
    segundo.unmount();

    clerkFalso.getToken = async () => null;
    render(<TableroTareas />);
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo obtener la sesión'
    );
  });

  test('sesión expirada redirige al login', async () => {
    spyOn(api, 'listarTareas').mockRejectedValue(new api.ErrorSesionExpirada());
    render(<TableroTareas />);
    await waitFor(() => expect(destino).toBe('/login?expirada=1'));
  });
});
