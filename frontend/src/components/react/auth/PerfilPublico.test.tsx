/**
 * Pruebas del perfil público de un afiliado (US-012 Esc 2 y US-017): perfil,
 * reputación, disponibilidad y valoraciones. La red se simula con `spyOn`.
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
import PerfilPublico, {
  MENSAJE_AFILIADO_NUEVO,
  MENSAJE_ERROR_PERFIL,
  MENSAJE_PERFIL_NO_ENCONTRADO,
} from './PerfilPublico';

const ID = '22222222-2222-4222-8222-222222222222';

const perfil = (
  cambios: Partial<api.UsuarioPublico> = {}
): api.UsuarioPublico => ({
  id: ID,
  nombre: 'José Ríos',
  email: 'jose@ejemplo.com',
  rol: 'afiliado',
  fotoUrl: '/uploads/perfiles/jose.jpg',
  descripcion: 'Plomero con 8 años de experiencia.',
  ubicacion: 'Envigado',
  creadoEn: '2026-01-01T00:00:00.000Z',
  ...cambios,
});

const valoracion = (
  id: string,
  puntuacion: number,
  cliente: string,
  comentario: string | null = null,
  fechaServicio: string | null = '2026-03-15T12:00:00.000Z'
): api.ValoracionApi => ({
  id,
  puntuacion,
  comentario,
  fecha: '2026-03-16T12:00:00.000Z',
  fechaServicio,
  cliente: { nombre: cliente },
});

const SIN_VALORACIONES: api.ReputacionApi = {
  promedio: null,
  total: 0,
  valoraciones: [],
};

let nav: ReturnType<typeof simularNavegacion>;

/** Monta el perfil con los tres servicios simulados. */
function conDatos(
  datos: {
    perfil?: api.UsuarioPublico;
    slots?: api.SlotApi[];
    reputacion?: api.ReputacionApi;
  } = {}
) {
  spyOn(api, 'obtenerPerfilPublico').mockResolvedValue(
    datos.perfil ?? perfil()
  );
  spyOn(api, 'obtenerDisponibilidadDe').mockResolvedValue(datos.slots ?? []);
  spyOn(api, 'obtenerReputacion').mockResolvedValue(
    datos.reputacion ?? SIN_VALORACIONES
  );
}

beforeEach(() => {
  resetSesion();
  process.env.PUBLIC_API_URL = 'http://api.test';
  nav = simularNavegacion(`?id=${ID}`);
});

afterEach(() => {
  cleanup();
  nav.restaurar();
  spyOn(api, 'obtenerPerfilPublico').mockRestore();
  spyOn(api, 'obtenerDisponibilidadDe').mockRestore();
  spyOn(api, 'obtenerReputacion').mockRestore();
});

describe('PerfilPublico', () => {
  test('muestra descripción, disponibilidad y la reputación en la cabecera', async () => {
    // Given: un afiliado con horario y reputación 4,7 con dos valoraciones
    conDatos({
      slots: [
        { diaSemana: 1, franjaHoraria: 'tarde' },
        { diaSemana: 0, franjaHoraria: 'manana' },
      ],
      reputacion: {
        promedio: 4.7,
        total: 3,
        valoraciones: [
          valoracion('v1', 5, 'Ana Pérez', 'Excelente trabajo'),
          valoracion('v2', 4, 'Luis Gómez'),
        ],
      },
    });
    // When: se abre su perfil
    render(<PerfilPublico />);
    // Then: nombre, foto, ubicación y descripción
    expect(
      await screen.findByRole('heading', { name: 'José Ríos', level: 2 })
    ).toBeTruthy();
    expect(
      (screen.getByAltText('Foto de José Ríos') as HTMLImageElement).src
    ).toBe('http://api.test/uploads/perfiles/jose.jpg');
    expect(screen.getByText('Envigado')).toBeTruthy();
    expect(screen.getByText('Plomero con 8 años de experiencia.')).toBeTruthy();
    // Then (Esc 1 y 4): "4,7 / 5,0 estrellas" y el puntaje en estrellas, sin cálculo en el cliente
    expect(screen.getByText('4,7 / 5,0 estrellas')).toBeTruthy();
    expect(
      screen.getByRole('img', { name: '4,7 de 5 estrellas, 3 calificaciones' })
    ).toBeTruthy();
    expect(screen.queryByText(MENSAJE_AFILIADO_NUEVO)).toBeNull();
    // Then: la disponibilidad marca solo las franjas configuradas
    expect(screen.getByLabelText('Lun Tarde: disponible')).toBeTruthy();
    expect(screen.getByLabelText('Dom Mañana: disponible')).toBeTruthy();
    expect(screen.getByLabelText('Mar Noche: no disponible')).toBeTruthy();
  });

  test('Esc 2: lista las valoraciones en el orden recibido con cliente y fecha del servicio', async () => {
    // Given: dos valoraciones, la más reciente primero
    conDatos({
      reputacion: {
        promedio: 4.5,
        total: 2,
        valoraciones: [
          valoracion('v1', 5, 'Ana Pérez', 'Excelente trabajo'),
          valoracion('v2', 4, 'Luis Gómez'),
        ],
      },
    });
    // When: se abre su perfil
    render(<PerfilPublico />);
    await screen.findByRole('heading', { name: 'Valoraciones' });
    // Then: el orden es el que entrega el servidor y cada una trae cliente, reseña y fecha
    const clientes = screen
      .getAllByRole('heading', { level: 4 })
      .map((h) => h.textContent);
    expect(clientes).toEqual(['Ana Pérez', 'Luis Gómez']);
    expect(screen.getByText('“Excelente trabajo”')).toBeTruthy();
    expect(
      screen.getAllByText(/Servicio realizado el .*15.*mar.*2026/)
    ).toHaveLength(2);
  });

  test('una valoración sin fecha de servicio usa la fecha de la calificación; con fecha ilegible no muestra fecha', async () => {
    // Given: una sin fecha de servicio y otra con fecha ilegible
    conDatos({
      reputacion: {
        promedio: 4,
        total: 2,
        valoraciones: [
          valoracion('v1', 4, 'Ana Pérez', null, null),
          {
            ...valoracion('v2', 4, 'Luis Gómez', null, 'no-es-fecha'),
            fecha: 'tampoco',
          },
        ],
      },
    });
    // When: se abre su perfil
    render(<PerfilPublico />);
    await screen.findByRole('heading', { name: 'Valoraciones' });
    // Then: la primera usa la fecha de la calificación (16 mar) y la segunda no muestra fecha
    expect(screen.getAllByText(/Servicio realizado el/)).toHaveLength(1);
    expect(screen.getByText(/16.*mar.*2026/)).toBeTruthy();
  });

  test('Esc 3: un afiliado nuevo ve el estado neutral, sin "0,0" ni sección de valoraciones', async () => {
    // Given: un afiliado sin valoraciones, foto, descripción ni horario
    conDatos({
      perfil: perfil({ fotoUrl: null, descripcion: null, ubicacion: null }),
    });
    // When: se abre su perfil
    render(<PerfilPublico />);
    await screen.findByRole('heading', { name: 'José Ríos', level: 2 });
    // Then: mensaje neutral exacto, ningún promedio y sin sección de valoraciones
    expect(screen.getByText(MENSAJE_AFILIADO_NUEVO)).toBeTruthy();
    expect(screen.queryByText(/0,0/)).toBeNull();
    expect(screen.queryByText(/estrellas$/)).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Valoraciones' })).toBeNull();
    expect(screen.queryByRole('img', { name: /Foto de/ })).toBeNull();
    expect(screen.getByText('Aún no ha escrito una descripción.')).toBeTruthy();
    expect(
      screen.getByText('Aún no ha configurado su disponibilidad.')
    ).toBeTruthy();
  });

  test('pide los tres datos con el id de la URL y el token', async () => {
    // Given: un perfil
    conDatos();
    // When: se abre
    render(<PerfilPublico />);
    await screen.findByRole('heading', { name: 'José Ríos', level: 2 });
    // Then: cada servicio recibe el id (y el token donde hace falta)
    expect(api.obtenerPerfilPublico).toHaveBeenCalledWith(ID);
    expect(api.obtenerDisponibilidadDe).toHaveBeenCalledWith('token-falso', ID);
    expect(api.obtenerReputacion).toHaveBeenCalledWith(ID);
  });

  test('muestra "Cargando" mientras llegan los datos', () => {
    // Given: servicios que no responden todavía
    spyOn(api, 'obtenerPerfilPublico').mockReturnValue(new Promise(() => {}));
    spyOn(api, 'obtenerDisponibilidadDe').mockReturnValue(
      new Promise(() => {})
    );
    spyOn(api, 'obtenerReputacion').mockReturnValue(new Promise(() => {}));
    // When: se abre
    render(<PerfilPublico />);
    // Then: indica que carga
    expect(screen.getByRole('status').textContent).toContain('Cargando');
  });

  test('sin id en la URL, o si no se puede leer, no encuentra el perfil', async () => {
    // Given: una URL sin ?id=
    nav.restaurar();
    nav = simularNavegacion('');
    const perfilSpy = spyOn(api, 'obtenerPerfilPublico');
    const { unmount } = render(<PerfilPublico />);
    // Then: mensaje de no encontrado sin consultar nada
    expect((await screen.findByRole('alert')).textContent).toBe(
      MENSAJE_PERFIL_NO_ENCONTRADO
    );
    expect(perfilSpy).not.toHaveBeenCalled();
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
      render(<PerfilPublico />);
      // Then: también no encontrado
      expect((await screen.findByRole('alert')).textContent).toBe(
        MENSAJE_PERFIL_NO_ENCONTRADO
      );
    } finally {
      if (original) Object.defineProperty(window, 'location', original);
    }
  });

  test('un fallo de red muestra el mensaje y permite reintentar', async () => {
    // Given: el perfil falla la primera vez
    conDatos();
    (
      api.obtenerPerfilPublico as unknown as ReturnType<typeof spyOn>
    ).mockRejectedValueOnce(new Error('offline'));
    render(<PerfilPublico />);
    // When: falla la carga
    expect((await screen.findByRole('alert')).textContent).toContain(
      MENSAJE_ERROR_PERFIL
    );
    // When: se reintenta
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/i }));
    // Then: se carga el perfil
    expect(
      await screen.findByRole('heading', { name: 'José Ríos', level: 2 })
    ).toBeTruthy();
  });

  test('sin sesión invita a iniciar sesión; con sesión expirada redirige', async () => {
    // Given: no hay token
    localStorage.removeItem('ch-token');
    const perfilSpy = spyOn(api, 'obtenerPerfilPublico');
    const { unmount } = render(<PerfilPublico />);
    // Then: invita a iniciar sesión sin pedir nada
    expect(
      await screen.findByRole('link', { name: /Iniciar sesión/i })
    ).toBeTruthy();
    expect(perfilSpy).not.toHaveBeenCalled();
    unmount();
    // Given: un backend que responde 401
    resetSesion();
    spyOn(api, 'obtenerPerfilPublico').mockRejectedValue(
      new api.ErrorSesionExpirada()
    );
    spyOn(api, 'obtenerDisponibilidadDe').mockResolvedValue([]);
    spyOn(api, 'obtenerReputacion').mockResolvedValue(SIN_VALORACIONES);
    // When: se abre
    render(<PerfilPublico />);
    // Then: redirige a /login?expirada=1
    await waitFor(() => expect(nav.destino()).toBe('/login?expirada=1'));
  });
});
