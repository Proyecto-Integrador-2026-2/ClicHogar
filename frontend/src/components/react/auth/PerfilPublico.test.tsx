/**
 * Pruebas del perfil público de un afiliado (US-012, Escenario 2): perfil,
 * disponibilidad y valoraciones previas.
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
  MENSAJE_ERROR_PERFIL,
  MENSAJE_PERFIL_NO_ENCONTRADO,
  promedioDe,
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

const calificacion = (
  id: string,
  puntuacion: number,
  comentario: string | null = null,
  creado_en = '2026-03-15T12:00:00.000Z'
): api.CalificacionApi => ({
  id,
  tarea_id: null,
  autor_id: 'u-x',
  destinatario_id: ID,
  puntuacion,
  comentario,
  creado_en,
});

let nav: ReturnType<typeof simularNavegacion>;

/** Monta el perfil con los tres servicios simulados. */
function conDatos(
  datos: {
    perfil?: api.UsuarioPublico;
    slots?: api.SlotApi[];
    calificaciones?: api.CalificacionApi[];
  } = {}
) {
  spyOn(api, 'obtenerPerfilPublico').mockResolvedValue(
    datos.perfil ?? perfil()
  );
  spyOn(api, 'obtenerDisponibilidadDe').mockResolvedValue(datos.slots ?? []);
  spyOn(api, 'listarCalificaciones').mockResolvedValue(
    datos.calificaciones ?? []
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
  spyOn(api, 'listarCalificaciones').mockRestore();
});

describe('promedioDe', () => {
  test('promedia con un decimal y devuelve null sin calificaciones', () => {
    // Given: sin calificaciones y con tres (5, 4, 4)
    // When / Then: null y 4,3
    expect(promedioDe([])).toBeNull();
    expect(
      promedioDe([
        calificacion('a', 5),
        calificacion('b', 4),
        calificacion('c', 4),
      ])
    ).toBe(4.3);
  });
});

describe('PerfilPublico', () => {
  test('muestra descripción, disponibilidad y valoraciones previas', async () => {
    // Given: un afiliado con horario y dos valoraciones
    conDatos({
      slots: [
        { diaSemana: 1, franjaHoraria: 'tarde' },
        { diaSemana: 0, franjaHoraria: 'manana' },
      ],
      calificaciones: [
        calificacion('c1', 5, 'Excelente trabajo'),
        calificacion('c2', 4),
      ],
    });
    // When: se abre su perfil
    render(<PerfilPublico />);
    // Then: se ve su nombre, foto, ubicación, descripción y promedio
    expect(
      await screen.findByRole('heading', { name: 'José Ríos' })
    ).toBeTruthy();
    expect(
      (screen.getByAltText('Foto de José Ríos') as HTMLImageElement).src
    ).toBe('http://api.test/uploads/perfiles/jose.jpg');
    expect(screen.getByText('Envigado')).toBeTruthy();
    expect(screen.getByText('Plomero con 8 años de experiencia.')).toBeTruthy();
    expect(
      screen.getByRole('img', { name: '4,5 de 5 estrellas, 2 calificaciones' })
    ).toBeTruthy();
    // Then: la disponibilidad marca solo las franjas configuradas
    expect(screen.getByLabelText('Lun Tarde: disponible')).toBeTruthy();
    expect(screen.getByLabelText('Dom Mañana: disponible')).toBeTruthy();
    expect(screen.getByLabelText('Mar Noche: no disponible')).toBeTruthy();
    // Then: las valoraciones previas con su comentario
    expect(screen.getByText('“Excelente trabajo”')).toBeTruthy();
    expect(screen.getAllByText(/15.*mar.*2026/)).toHaveLength(2);
  });

  test('sin foto, descripción, horario ni valoraciones muestra los estados vacíos', async () => {
    // Given: un afiliado recién llegado
    conDatos({
      perfil: perfil({ fotoUrl: null, descripcion: null, ubicacion: null }),
    });
    // When: se abre su perfil
    render(<PerfilPublico />);
    // Then: textos de "aún no" en lugar de datos
    await screen.findByRole('heading', { name: 'José Ríos' });
    expect(screen.queryByRole('img', { name: /Foto de/ })).toBeNull();
    expect(screen.getByText('Aún no ha escrito una descripción.')).toBeTruthy();
    expect(
      screen.getByText('Aún no ha configurado su disponibilidad.')
    ).toBeTruthy();
    expect(screen.getByText('Aún no tiene valoraciones.')).toBeTruthy();
    expect(screen.getByText('Sin calificaciones')).toBeTruthy();
  });

  test('una valoración con fecha ilegible no muestra fecha', async () => {
    // Given: una valoración con fecha inválida
    conDatos({ calificaciones: [calificacion('c1', 3, null, 'no-es-fecha')] });
    // When: se abre su perfil
    render(<PerfilPublico />);
    // Then: se muestra sin fecha
    await screen.findByRole('heading', { name: 'José Ríos' });
    expect(screen.queryByText(/2026/)).toBeNull();
  });

  test('pide los tres datos con el id de la URL y el token', async () => {
    // Given: un perfil
    conDatos();
    const disponibilidad = api.obtenerDisponibilidadDe as unknown as ReturnType<
      typeof spyOn
    >;
    // When: se abre
    render(<PerfilPublico />);
    await screen.findByRole('heading', { name: 'José Ríos' });
    // Then: cada servicio recibe el id (y el token donde hace falta)
    expect(api.obtenerPerfilPublico).toHaveBeenCalledWith(ID);
    expect(disponibilidad).toHaveBeenCalledWith('token-falso', ID);
    expect(api.listarCalificaciones).toHaveBeenCalledWith(ID);
  });

  test('muestra "Cargando" mientras llegan los datos', () => {
    // Given: servicios que no responden todavía
    spyOn(api, 'obtenerPerfilPublico').mockReturnValue(new Promise(() => {}));
    spyOn(api, 'obtenerDisponibilidadDe').mockReturnValue(
      new Promise(() => {})
    );
    spyOn(api, 'listarCalificaciones').mockReturnValue(new Promise(() => {}));
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
    // When: se abre
    const { unmount } = render(<PerfilPublico />);
    // Then: mensaje de no encontrado sin consultar nada
    expect((await screen.findByRole('alert')).textContent).toBe(
      MENSAJE_PERFIL_NO_ENCONTRADO
    );
    expect(perfilSpy).not.toHaveBeenCalled();
    unmount();
    // Given: una página cuya URL no se puede leer
    nav.restaurar();
    Object.defineProperty(window, 'location', {
      configurable: true,
      get() {
        throw new Error('sin acceso');
      },
    });
    // When: se abre
    render(<PerfilPublico />);
    // Then: también no encontrado
    expect((await screen.findByRole('alert')).textContent).toBe(
      MENSAJE_PERFIL_NO_ENCONTRADO
    );
    nav = simularNavegacion();
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
      await screen.findByRole('heading', { name: 'José Ríos' })
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
    spyOn(api, 'listarCalificaciones').mockResolvedValue([]);
    // When: se abre
    render(<PerfilPublico />);
    // Then: redirige a /login?expirada=1
    await waitFor(() => expect(nav.destino()).toBe('/login?expirada=1'));
  });
});
