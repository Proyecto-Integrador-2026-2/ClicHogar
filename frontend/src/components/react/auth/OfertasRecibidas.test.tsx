/**
 * Pruebas de las ofertas recibidas (US-012). `listarOfertasRecibidas` se
 * simula; cada prueba mapea a un escenario de aceptación.
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
import OfertasRecibidas, {
  MENSAJE_ERROR_ASIGNAR,
  MENSAJE_ERROR_OFERTAS,
  MENSAJE_SIN_OFERTAS,
  MENSAJE_SIN_PERMISO_OFERTAS,
  hrefPerfil,
} from './OfertasRecibidas';

const oferta = (
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

let nav: ReturnType<typeof simularNavegacion>;

beforeEach(() => {
  resetSesion();
  process.env.PUBLIC_API_URL = 'http://api.test';
  nav = simularNavegacion();
});

afterEach(() => {
  cleanup();
  nav.restaurar();
  spyOn(api, 'listarOfertasRecibidas').mockRestore();
  spyOn(api, 'asignarTarea').mockRestore();
});

describe('OfertasRecibidas', () => {
  test('Esc 1 y 5: lista foto, nombre, estrellas y mensaje, en el orden recibido', async () => {
    // Given: dos ofertas, la primera de mejor reputación y con foto
    const listar = spyOn(api, 'listarOfertasRecibidas').mockResolvedValue([
      oferta('o-1', { fotoUrl: '/uploads/perfiles/a.jpg', promedio: 4.8 }),
      oferta('o-2', { promedio: null, totalCalificaciones: 0 }),
    ]);
    // When: el creador abre las ofertas
    render(<OfertasRecibidas tareaId="t-1" />);
    // Then: ve a los afiliados en el orden recibido, con su reputación y propuesta
    const nombres = (await screen.findAllByRole('heading', { level: 4 })).map(
      (h) => h.textContent
    );
    expect(nombres).toEqual(['Afiliado o-1', 'Afiliado o-2']);
    expect(
      screen.getByRole('img', { name: '4,8 de 5 estrellas, 2 calificaciones' })
    ).toBeTruthy();
    expect(screen.getByText('Sin calificaciones')).toBeTruthy();
    expect(screen.getByText('“Propuesta de o-1”')).toBeTruthy();
    expect(
      (screen.getByAltText('Foto de Afiliado o-1') as HTMLImageElement).src
    ).toBe('http://api.test/uploads/perfiles/a.jpg');
    // Then: sin foto se muestra la inicial
    expect(screen.getByText('A')).toBeTruthy();
    expect(listar).toHaveBeenCalledWith('token-falso', 't-1');
  });

  test('Esc 2: la foto y el nombre llevan al perfil público del afiliado', async () => {
    // Given: una oferta
    spyOn(api, 'listarOfertasRecibidas').mockResolvedValue([oferta('o-1')]);
    render(<OfertasRecibidas tareaId="t-1" />);
    await screen.findByRole('heading', { level: 4 });
    // When: se miran los enlaces del afiliado
    const enlaces = screen.getAllByRole('link');
    // Then: tanto la foto como el nombre apuntan a su perfil
    expect(enlaces.map((e) => e.getAttribute('href'))).toEqual([
      '/perfil/publico?id=a-o-1',
      '/perfil/publico?id=a-o-1',
    ]);
    expect(hrefPerfil('a b')).toBe('/perfil/publico?id=a%20b');
  });

  test('una oferta sin mensaje ni fecha válida no inventa nada', async () => {
    // Given: una oferta sin propuesta y con fecha ilegible
    spyOn(api, 'listarOfertasRecibidas').mockResolvedValue([
      oferta('o-1', {}, { mensaje: null, creadoEn: 'no-es-fecha' }),
    ]);
    // When: se abre la lista
    render(<OfertasRecibidas tareaId="t-1" />);
    await screen.findByRole('heading', { level: 4 });
    // Then: no hay comillas de propuesta ni "Postulado el"
    expect(screen.queryByText(/“/)).toBeNull();
    expect(screen.queryByText(/Postulado el/)).toBeNull();
  });

  test('muestra "Cargando" mientras llegan las ofertas', () => {
    // Given: un backend que no responde todavía
    spyOn(api, 'listarOfertasRecibidas').mockReturnValue(new Promise(() => {}));
    // When: se abre la lista
    render(<OfertasRecibidas tareaId="t-1" />);
    // Then: indica que carga
    expect(screen.getByRole('status').textContent).toContain('Cargando');
  });

  test('Esc 3: sin ofertas muestra el mensaje de estado vacío', async () => {
    // Given: una tarea sin postulaciones
    spyOn(api, 'listarOfertasRecibidas').mockResolvedValue([]);
    // When: se abre la lista
    render(<OfertasRecibidas tareaId="t-1" />);
    // Then: aparece el mensaje de la historia y ninguna lista
    expect(await screen.findByText(MENSAJE_SIN_OFERTAS)).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });

  test('Esc 4: quien no es el creador solo ve el aviso de permisos', async () => {
    // Given: un backend que responde 403
    spyOn(api, 'listarOfertasRecibidas').mockRejectedValue(
      new api.ErrorSinPermisoOfertas()
    );
    // When: se abre la lista
    render(<OfertasRecibidas tareaId="t-1" />);
    // Then: solo el mensaje de permisos, sin ningún dato de postulantes
    expect((await screen.findByRole('alert')).textContent).toBe(
      MENSAJE_SIN_PERMISO_OFERTAS
    );
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('heading', { level: 4 })).toBeNull();
  });

  test('un fallo de red muestra el mensaje y permite reintentar', async () => {
    // Given: un backend que falla la primera vez
    const listar = spyOn(api, 'listarOfertasRecibidas').mockRejectedValueOnce(
      new Error('offline')
    );
    render(<OfertasRecibidas tareaId="t-1" />);
    // When: falla la carga
    expect((await screen.findByRole('alert')).textContent).toContain(
      MENSAJE_ERROR_OFERTAS
    );
    // When: el backend se recupera y se pulsa Reintentar
    listar.mockResolvedValue([oferta('o-1')]);
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/i }));
    // Then: se muestra la oferta
    expect(await screen.findByText('Afiliado o-1')).toBeTruthy();
  });

  test('sesión expirada o sin token: redirige al login', async () => {
    // Given: un backend que responde 401
    spyOn(api, 'listarOfertasRecibidas').mockRejectedValue(
      new api.ErrorSesionExpirada()
    );
    render(<OfertasRecibidas tareaId="t-1" />);
    // Then: redirige a /login?expirada=1
    await waitFor(() => expect(nav.destino()).toBe('/login?expirada=1'));
    // Given: ahora sin token guardado
    cleanup();
    nav.restaurar();
    nav = simularNavegacion();
    localStorage.removeItem('ch-token');
    const listar = spyOn(api, 'listarOfertasRecibidas');
    listar.mockClear();
    // When: se abre otra vez
    render(<OfertasRecibidas tareaId="t-1" />);
    // Then: redirige igual sin llamar al backend
    await waitFor(() => expect(nav.destino()).toBe('/login?expirada=1'));
    expect(listar).not.toHaveBeenCalled();
  });
});

describe('OfertasRecibidas: selección del prestador (US-013)', () => {
  const ASIGNACION: api.AsignacionApi = {
    tareaId: 't-1',
    estado: 'asignada',
    afiliadoId: 'a-o-1',
  };

  function montar(
    props: Partial<React.ComponentProps<typeof OfertasRecibidas>> = {}
  ) {
    const resultados: string[] = [];
    render(
      <OfertasRecibidas
        tareaId="t-1"
        tareaAbierta
        onResultado={(r) => resultados.push(r)}
        {...props}
      />
    );
    return resultados;
  }

  const seleccionar = async () =>
    fireEvent.click(
      (
        await screen.findAllByRole('button', { name: 'Seleccionar afiliado' })
      )[0]!
    );
  const confirmar = () =>
    fireEvent.click(
      screen.getByRole('button', { name: /Confirmar selección|Enviando/ })
    );

  test('solo una tarea abierta permite seleccionar, y solo ofertas pendientes', async () => {
    // Given: una oferta pendiente y una ya resuelta de cada tipo
    spyOn(api, 'listarOfertasRecibidas').mockResolvedValue([
      oferta('o-1'),
      oferta('o-2', {}, { estado: 'aceptada' }),
      oferta('o-3', {}, { estado: 'rechazada' }),
    ]);
    // When: la tarea está abierta
    const { unmount } = render(<OfertasRecibidas tareaId="t-1" tareaAbierta />);
    await screen.findByText('Afiliado o-1');
    // Then: solo la pendiente tiene botón y las otras muestran su estado
    expect(
      screen.getAllByRole('button', { name: 'Seleccionar afiliado' })
    ).toHaveLength(1);
    expect(screen.getByText('Seleccionado')).toBeTruthy();
    expect(screen.getByText('No seleccionado')).toBeTruthy();
    unmount();
    // When: la tarea ya no está abierta
    render(<OfertasRecibidas tareaId="t-1" tareaAbierta={false} />);
    await screen.findByText('Afiliado o-1');
    // Then: nadie se puede seleccionar
    expect(
      screen.queryByRole('button', { name: 'Seleccionar afiliado' })
    ).toBeNull();
  });

  test('Esc 1: elige al afiliado tras confirmar y avisa al padre', async () => {
    // Given: una oferta pendiente y un backend que asigna
    spyOn(api, 'listarOfertasRecibidas').mockResolvedValue([oferta('o-1')]);
    const asignar = spyOn(api, 'asignarTarea').mockResolvedValue(ASIGNACION);
    const resultados = montar();
    // When: selecciona y confirma
    await seleccionar();
    expect(
      screen.getByRole('dialog', { name: 'Confirmar selección' }).textContent
    ).toContain('Afiliado o-1');
    confirmar();
    // Then: se asigna esa oferta, se cierra el diálogo y el padre recibe 'asignada'
    await waitFor(() => expect(resultados).toEqual(['asignada']));
    expect(asignar).toHaveBeenCalledWith('token-falso', 't-1', 'o-1');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('Esc 6: cancelar la confirmación no cambia nada', async () => {
    // Given: el diálogo abierto
    spyOn(api, 'listarOfertasRecibidas').mockResolvedValue([oferta('o-1')]);
    const asignar = spyOn(api, 'asignarTarea');
    const resultados = montar();
    await seleccionar();
    // When: cancela
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    // Then: vuelve a la lista sin asignar ni avisar
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Afiliado o-1')).toBeTruthy();
    expect(asignar).not.toHaveBeenCalled();
    expect(resultados).toEqual([]);
  });

  test('Esc 5: confirmaciones repetidas registran una sola asignación', async () => {
    // Given: un backend lento
    spyOn(api, 'listarOfertasRecibidas').mockResolvedValue([oferta('o-1')]);
    let resolver: (a: api.AsignacionApi) => void = () => {};
    const asignar = spyOn(api, 'asignarTarea').mockReturnValue(
      new Promise((r) => {
        resolver = r;
      })
    );
    const resultados = montar();
    await seleccionar();
    const boton = screen.getByRole('button', { name: 'Confirmar selección' });
    // When: se hace clic varias veces
    fireEvent.click(boton);
    fireEvent.click(boton);
    fireEvent.click(boton);
    // Then: una sola petición
    expect(asignar).toHaveBeenCalledTimes(1);
    resolver(ASIGNACION);
    await waitFor(() => expect(resultados).toEqual(['asignada']));
  });

  test('Esc 5: si la tarea ya estaba asignada avisa al padre con "ya-asignada"', async () => {
    // Given: un backend que dice que ya hay un afiliado asignado
    spyOn(api, 'listarOfertasRecibidas').mockResolvedValue([oferta('o-1')]);
    spyOn(api, 'asignarTarea').mockRejectedValue(
      new api.ErrorTareaYaAsignada()
    );
    const resultados = montar();
    await seleccionar();
    // When: confirma
    confirmar();
    // Then: cierra el diálogo y el padre recibe 'ya-asignada'
    await waitFor(() => expect(resultados).toEqual(['ya-asignada']));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('un fallo de conexión muestra el aviso dentro del diálogo y permite reintentar', async () => {
    // Given: un backend sin conexión
    spyOn(api, 'listarOfertasRecibidas').mockResolvedValue([oferta('o-1')]);
    const asignar = spyOn(api, 'asignarTarea').mockRejectedValue(
      new api.ErrorSinConexion()
    );
    const resultados = montar();
    await seleccionar();
    // When: confirma
    confirmar();
    // Then: aviso de conexión, sigue abierto y no se asigna
    const alertas = await screen.findAllByRole('alert');
    expect(alertas.map((a) => a.textContent)).toContain(MENSAJE_ERROR_ASIGNAR);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(resultados).toEqual([]);
    // When: se recupera y reintenta
    asignar.mockResolvedValue(ASIGNACION);
    confirmar();
    // Then: se asigna
    await waitFor(() => expect(resultados).toEqual(['asignada']));
  });

  test('un rechazo de negocio muestra la explicación; un valor raro, el mensaje genérico', async () => {
    // Given: un backend que rechaza con explicación
    spyOn(api, 'listarOfertasRecibidas').mockResolvedValue([oferta('o-1')]);
    const asignar = spyOn(api, 'asignarTarea').mockRejectedValue(
      new Error('Oferta no encontrada.')
    );
    montar();
    await seleccionar();
    // When: confirma
    confirmar();
    // Then: muestra el mensaje del backend
    await waitFor(() =>
      expect(screen.getAllByRole('alert').map((a) => a.textContent)).toContain(
        'Oferta no encontrada.'
      )
    );
    // Given: ahora un rechazo que no es Error
    asignar.mockRejectedValue('boom');
    // When: reintenta
    confirmar();
    // Then: mensaje genérico
    await waitFor(() =>
      expect(screen.getAllByRole('alert').map((a) => a.textContent)).toContain(
        MENSAJE_ERROR_ASIGNAR
      )
    );
  });

  test('sesión expirada o sin token al confirmar: redirige al login', async () => {
    // Given: un backend que responde 401
    spyOn(api, 'listarOfertasRecibidas').mockResolvedValue([oferta('o-1')]);
    const asignar = spyOn(api, 'asignarTarea').mockRejectedValue(
      new api.ErrorSesionExpirada()
    );
    montar();
    await seleccionar();
    // When: confirma
    confirmar();
    // Then: redirige a /login?expirada=1
    await waitFor(() => expect(nav.destino()).toBe('/login?expirada=1'));
    // Given: ahora sin token
    nav.restaurar();
    nav = simularNavegacion();
    localStorage.removeItem('ch-token');
    asignar.mockClear();
    // When: confirma otra vez
    confirmar();
    // Then: redirige igual sin llamar al backend
    await waitFor(() => expect(nav.destino()).toBe('/login?expirada=1'));
    expect(asignar).not.toHaveBeenCalled();
  });
});
