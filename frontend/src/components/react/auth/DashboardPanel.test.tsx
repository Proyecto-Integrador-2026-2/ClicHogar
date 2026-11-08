/**
 * Pruebas de DashboardPanel: estados de carga, sin sesión, datos, error con
 * reintento y sesión expirada (redirect). La red se simula con `spyOn`.
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
import DashboardPanel from './DashboardPanel';

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

const tarea = (id: string, estado = 'abierta') =>
  ({
    id,
    titulo: `Tarea ${id}`,
    descripcion: 'Desc',
    categoria: 'Limpieza',
    estado,
    ubicacion: 'Envigado',
    latitud: null,
    longitud: null,
    autorId: 'u2',
    autorNombre: 'Luis',
    creadoEn: '2026-03-05T12:00:00Z',
  }) satisfies api.TareaTablero;

const pagina = (
  tareas: api.TareaTablero[],
  hayMas = false
): api.PaginaTareasTablero => ({ tareas, pagina: 1, limite: 50, hayMas });

let nav: ReturnType<typeof simularNavegacion>;

beforeEach(() => {
  resetSesion();
  nav = simularNavegacion();
});

afterEach(() => {
  cleanup();
  nav.restaurar();
  spyOn(api, 'obtenerPerfil').mockRestore();
  spyOn(api, 'listarTareas').mockRestore();
});

describe('DashboardPanel', () => {
  test('muestra carga mientras pide los datos', () => {
    // Given: un backend que no responde todavía
    spyOn(api, 'obtenerPerfil').mockReturnValue(new Promise(() => {}));
    spyOn(api, 'listarTareas').mockReturnValue(new Promise(() => {}));
    // When: se renderiza el panel
    render(<DashboardPanel />);
    // Then: muestra 'Cargando'
    expect(screen.getByRole('status').textContent).toContain('Cargando');
  });

  test('sin sesión invita a iniciar sesión y no llama al backend', async () => {
    // Given: no hay token guardado
    localStorage.removeItem('ch-token');
    const perfil = spyOn(api, 'obtenerPerfil');
    // When: se renderiza el panel
    render(<DashboardPanel />);
    // Then: invita a iniciar sesión sin pedir nada
    expect(await screen.findByText('Iniciar sesión')).toBeTruthy();
    expect(perfil).not.toHaveBeenCalled();
  });

  test('con sesión muestra saludo, rol, perfil pendiente y tareas', async () => {
    // Given: un perfil de afiliado incompleto y dos tareas, una abierta
    spyOn(api, 'obtenerPerfil').mockResolvedValue(PERFIL);
    spyOn(api, 'listarTareas').mockResolvedValue(
      pagina([tarea('1'), tarea('2', 'cerrada')])
    );
    // When: se renderiza el panel
    render(<DashboardPanel />);
    // Then: saluda por el nombre del perfil y muestra el resumen
    expect(await screen.findByText('Hola, Ana Pérez')).toBeTruthy();
    expect(screen.getByText(/resumen como Clic-Worker/)).toBeTruthy();
    expect(screen.getByText(/Falta: Foto, Ubicación/)).toBeTruthy();
    expect(screen.getByText('Explorar tablero')).toBeTruthy();
    expect(screen.getByText('Tareas abiertas').nextSibling?.textContent).toBe(
      '1Explorar tablero'
    );
  });

  test('si hay más tareas abiertas que el bloque contado, añade "+"', async () => {
    // Given: una página con una tarea abierta y más disponibles
    spyOn(api, 'obtenerPerfil').mockResolvedValue(PERFIL);
    spyOn(api, 'listarTareas').mockResolvedValue(pagina([tarea('1')], true));
    // When: se renderiza el panel
    render(<DashboardPanel />);
    // Then: el contador muestra 1+
    await screen.findByText('Hola, Ana Pérez');
    expect(screen.getByText('Tareas abiertas').nextSibling?.textContent).toBe(
      '1+Explorar tablero'
    );
  });

  test('perfil completo muestra "Completo" y el rol de cliente', async () => {
    // Given: un perfil completo de cliente
    spyOn(api, 'obtenerPerfil').mockResolvedValue({
      ...PERFIL,
      rol: 'cliente',
      fotoUrl: '/f.jpg',
      ubicacion: 'Envigado',
    });
    spyOn(api, 'listarTareas').mockResolvedValue(pagina([]));
    // When: se renderiza el panel
    render(<DashboardPanel />);
    // Then: muestra 'Completo' y el rol
    expect(await screen.findByText('Completo')).toBeTruthy();
    expect(screen.getByText(/resumen como Cliente/)).toBeTruthy();
  });

  test('error: alerta, saludo genérico y reintento que recarga', async () => {
    // Given: un backend que falla la primera vez
    const perfil = spyOn(api, 'obtenerPerfil').mockRejectedValueOnce(
      new Error('Sin servidor')
    );
    spyOn(api, 'listarTareas').mockResolvedValue(pagina([]));
    // When: se renderiza el panel
    render(<DashboardPanel />);
    // Then: muestra la alerta con el error y saluda como 'miembro'
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Sin servidor'
    );
    expect(screen.getByText('Hola, miembro')).toBeTruthy();
    expect(screen.getByText('Este es tu resumen')).toBeTruthy();
    perfil.mockResolvedValue(PERFIL);
    // When: se pulsa Reintentar con el backend ya recuperado
    fireEvent.click(screen.getByText('Reintentar'));
    // Then: se carga el resumen
    expect(await screen.findByText(/resumen como Clic-Worker/)).toBeTruthy();
  });

  test('error que no es Error usa el mensaje genérico', async () => {
    // Given: un backend que rechaza con un valor que no es Error
    spyOn(api, 'obtenerPerfil').mockRejectedValue('boom');
    spyOn(api, 'listarTareas').mockResolvedValue(pagina([]));
    // When: se renderiza el panel
    render(<DashboardPanel />);
    // Then: muestra el mensaje genérico
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo cargar tu panel.'
    );
  });

  test('si el token desaparece antes de reintentar, vuelve a pedir sesión', async () => {
    // Given: una primera carga fallida
    spyOn(api, 'obtenerPerfil').mockRejectedValue(new Error('Caído'));
    spyOn(api, 'listarTareas').mockResolvedValue(pagina([]));
    render(<DashboardPanel />);
    await screen.findByRole('alert');
    // When: se pierde el token y se pulsa Reintentar
    localStorage.removeItem('ch-token');
    fireEvent.click(screen.getByText('Reintentar'));
    // Then: invita a iniciar sesión
    expect(await screen.findByText('Iniciar sesión')).toBeTruthy();
  });

  test('sesión expirada redirige al login', async () => {
    // Given: un backend que responde sesión expirada
    spyOn(api, 'obtenerPerfil').mockRejectedValue(
      new api.ErrorSesionExpirada()
    );
    spyOn(api, 'listarTareas').mockResolvedValue(pagina([]));
    // When: se renderiza el panel
    render(<DashboardPanel />);
    // Then: redirige a /login?expirada=1
    await waitFor(() => expect(nav.destino()).toBe('/login?expirada=1'));
  });
});
