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
    // Given: Clerk aún no terminó de cargar
    clerkFalso.isLoaded = false;
    // When: se renderiza el panel
    render(<DashboardPanel />);
    // Then: muestra 'Cargando'
    expect(screen.getByRole('status').textContent).toContain('Cargando');
  });

  test('sin sesión invita a iniciar sesión', async () => {
    // Given: Clerk cargado pero sin sesión
    clerkFalso.isSignedIn = false;
    // When: se renderiza el panel
    render(<DashboardPanel />);
    // Then: invita a iniciar sesión
    expect(await screen.findByText('Iniciar sesión')).toBeTruthy();
  });

  test('con sesión muestra saludo, rol, perfil pendiente y tareas', async () => {
    // Given: un perfil de afiliado incompleto y dos tareas, una abierta
    spyOn(api, 'obtenerPerfil').mockResolvedValue(PERFIL);
    spyOn(api, 'listarTareas').mockResolvedValue([
      tarea('1'),
      tarea('2', 'cerrada'),
    ]);
    // When: se renderiza el panel
    render(<DashboardPanel />);
    // Then: muestra el saludo, el rol, lo pendiente del perfil y el acceso al tablero
    expect(await screen.findByText('Hola, Ana')).toBeTruthy();
    expect(screen.getByText(/resumen como Clic-Worker/)).toBeTruthy();
    expect(screen.getByText(/Falta: Foto, Ubicación/)).toBeTruthy();
    expect(screen.getByText('Explorar tablero')).toBeTruthy();
  });

  test('perfil completo muestra "Completo" y usa el nombre del perfil sin firstName', async () => {
    // Given: un usuario sin firstName y un perfil completo de cliente
    clerkFalso.user = { firstName: null, username: null };
    spyOn(api, 'obtenerPerfil').mockResolvedValue({
      ...PERFIL,
      rol: 'cliente',
      fotoUrl: '/f.jpg',
      ubicacion: 'Envigado',
    });
    spyOn(api, 'listarTareas').mockResolvedValue([]);
    // When: se renderiza el panel
    render(<DashboardPanel />);
    // Then: usa el nombre del perfil y muestra 'Completo'
    expect(await screen.findByText('Hola, Ana Pérez')).toBeTruthy();
    expect(screen.getByText('Completo')).toBeTruthy();
    expect(screen.getByText(/resumen como Cliente/)).toBeTruthy();
  });

  test('sin firstName ni perfil cae en username y luego en "miembro"', async () => {
    // Given: un usuario sin firstName pero con username y un perfil que falla
    clerkFalso.user = { firstName: null, username: 'ana99' };
    spyOn(api, 'obtenerPerfil').mockRejectedValue(new Error('Caído'));
    spyOn(api, 'listarTareas').mockResolvedValue([]);
    // When: se renderiza el panel
    const { unmount } = render(<DashboardPanel />);
    // Then: saluda con el username
    expect(await screen.findByText('Hola, ana99')).toBeTruthy();
    unmount();

    // Given: ahora sin usuario
    clerkFalso.user = null;
    // When: se renderiza el panel
    render(<DashboardPanel />);
    // Then: saluda con 'miembro'
    expect(await screen.findByText('Hola, miembro')).toBeTruthy();
    expect(screen.getByText('Este es tu resumen')).toBeTruthy();
  });

  test('error: alerta y reintento que recarga', async () => {
    // Given: un backend que falla la primera vez
    const perfil = spyOn(api, 'obtenerPerfil').mockRejectedValueOnce(
      new Error('Sin servidor')
    );
    spyOn(api, 'listarTareas').mockResolvedValue([]);
    // When: se renderiza el panel
    render(<DashboardPanel />);
    // Then: muestra la alerta con el error
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Sin servidor'
    );
    perfil.mockResolvedValue(PERFIL);
    // When: se pulsa Reintentar con el backend ya recuperado
    fireEvent.click(screen.getByText('Reintentar'));
    // Then: se carga el resumen
    expect(await screen.findByText(/resumen como Clic-Worker/)).toBeTruthy();
  });

  test('error que no es Error usa el mensaje genérico', async () => {
    // Given: un backend que rechaza con un valor que no es Error
    spyOn(api, 'obtenerPerfil').mockRejectedValue('boom');
    spyOn(api, 'listarTareas').mockResolvedValue([]);
    // When: se renderiza el panel
    render(<DashboardPanel />);
    // Then: muestra el mensaje genérico
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo cargar tu panel.'
    );
  });

  test('sin token de sesión muestra el error correspondiente', async () => {
    // Given: una sesión sin token
    clerkFalso.getToken = async () => null;
    // When: se renderiza el panel
    render(<DashboardPanel />);
    // Then: muestra el error de sesión
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo obtener la sesión'
    );
  });

  test('sesión expirada redirige al login', async () => {
    // Given: un backend que responde sesión expirada
    spyOn(api, 'obtenerPerfil').mockRejectedValue(
      new api.ErrorSesionExpirada()
    );
    spyOn(api, 'listarTareas').mockResolvedValue([]);
    // When: se renderiza el panel
    render(<DashboardPanel />);
    // Then: redirige a /login?expirada=1
    await waitFor(() => expect(destino).toBe('/login?expirada=1'));
  });
});

describe('TableroTareas', () => {
  test('carga y sin sesión', async () => {
    // Given: Clerk aún sin cargar
    clerkFalso.isLoaded = false;
    // When: se renderiza el tablero
    const { unmount } = render(<TableroTareas />);
    // Then: muestra 'Cargando'
    expect(screen.getByRole('status').textContent).toContain('Cargando');
    unmount();

    clerkFalso.isLoaded = true;
    // Given: ahora cargado pero sin sesión
    clerkFalso.isSignedIn = false;
    // When: se renderiza el tablero
    render(<TableroTareas />);
    // Then: invita a iniciar sesión
    expect(await screen.findByText('Explora tareas')).toBeTruthy();
  });

  test('lista las tareas con fecha, y pluraliza el contador', async () => {
    // Given: dos tareas, una con fecha inválida
    spyOn(api, 'listarTareas').mockResolvedValue([
      tarea('1'),
      tarea('2', 'abierta', 'fecha-invalida'),
    ]);
    // When: se renderiza el tablero
    render(<TableroTareas />);
    // Then: lista las tareas con su autor y el contador en plural
    expect(await screen.findByText('2 solicitudes activas')).toBeTruthy();
    expect(screen.getByText('Tarea 1')).toBeTruthy();
    expect(screen.getAllByText('Abierta')).toHaveLength(2);
    expect(screen.getAllByText(/Envigado · Luis/)).toHaveLength(2);
  });

  test('una sola tarea usa el singular', async () => {
    // Given: una sola tarea
    spyOn(api, 'listarTareas').mockResolvedValue([tarea('1')]);
    // When: se renderiza el tablero
    render(<TableroTareas />);
    // Then: el contador usa el singular
    expect(await screen.findByText('1 solicitud activa')).toBeTruthy();
  });

  test('tablero vacío', async () => {
    // Given: un tablero sin tareas
    spyOn(api, 'listarTareas').mockResolvedValue([]);
    // When: se renderiza el tablero
    render(<TableroTareas />);
    // Then: explica que no hay tareas abiertas
    expect(
      await screen.findByText('Aún no hay solicitudes abiertas')
    ).toBeTruthy();
    expect(screen.getByText(/No hay tareas abiertas por ahora/)).toBeTruthy();
  });

  test('error con reintento, error genérico y sin token', async () => {
    // Given: un backend que falla la primera vez
    const lista = spyOn(api, 'listarTareas').mockRejectedValueOnce(
      new Error('Caído')
    );
    // When: se renderiza el tablero
    const { unmount } = render(<TableroTareas />);
    // Then: muestra la alerta con el error
    expect((await screen.findByRole('alert')).textContent).toContain('Caído');
    lista.mockResolvedValue([tarea('1')]);
    // When: se pulsa Reintentar con el backend recuperado
    fireEvent.click(screen.getByText('Reintentar'));
    // Then: se carga la lista
    expect(await screen.findByText('Tarea 1')).toBeTruthy();
    unmount();

    // Given: ahora un error que no es Error
    lista.mockRejectedValue('boom');
    // When: se renderiza el tablero
    const segundo = render(<TableroTareas />);
    // Then: muestra el mensaje genérico
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo cargar el tablero.'
    );
    segundo.unmount();

    // Given: y por último una sesión sin token
    clerkFalso.getToken = async () => null;
    // When: se renderiza el tablero
    render(<TableroTareas />);
    // Then: muestra el error de sesión
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo obtener la sesión'
    );
  });

  test('sesión expirada redirige al login', async () => {
    // Given: un backend que responde sesión expirada
    spyOn(api, 'listarTareas').mockRejectedValue(new api.ErrorSesionExpirada());
    // When: se renderiza el tablero
    render(<TableroTareas />);
    // Then: redirige a /login?expirada=1
    await waitFor(() => expect(destino).toBe('/login?expirada=1'));
  });
});
