/**
 * Pruebas del tablero de tareas (US-008). `fetch` se simula para las tareas
 * y `obtenerPerfil` con `spyOn`: sin red ni backend.
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from 'bun:test';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import React from 'react';
import { resetSesion, simularNavegacion } from '../../../../test-setup';
import * as api from '../../../lib/usuarios-api';
import TableroTareas, {
  MENSAJE_ERROR_PERFIL,
  MENSAJE_ERROR_TABLERO,
  MENSAJE_SOLO_AFILIADOS,
  MENSAJE_TABLERO_VACIO,
} from './TableroTareas';

const fetchOriginal = globalThis.fetch;
const apiOriginal = process.env.PUBLIC_API_URL;

const AFILIADO = { rol: 'afiliado' } as api.UsuarioPublico;
const CLIENTE = { rol: 'cliente' } as api.UsuarioPublico;

const tarea = (n: number, extra: Record<string, unknown> = {}) => ({
  id: `t-${n}`,
  titulo: `Tarea ${n}`,
  descripcion: `Descripción de la tarea ${n}, con detalle suficiente.`,
  categoria: 'Limpieza',
  estado: 'abierta',
  ubicacion: `Barrio ${n}`,
  latitud: null,
  longitud: null,
  autorId: 'u-1',
  autorNombre: 'Ana',
  creadoEn: '2026-03-15T12:00:00.000Z',
  ...extra,
});

const pagina = (tareas: unknown[], hayMas = false, numero = 1) => ({
  tareas,
  pagina: numero,
  limite: 12,
  hayMas,
});

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status });

let urls: string[] = [];
let respuestas: Array<Response | Error> = [];
let nav: ReturnType<typeof simularNavegacion>;

beforeEach(() => {
  resetSesion();
  process.env.PUBLIC_API_URL = 'http://api.test';
  nav = simularNavegacion();
  spyOn(api, 'obtenerPerfil').mockResolvedValue(AFILIADO);
  urls = [];
  respuestas = [];
  globalThis.fetch = mock(async (url: string) => {
    urls.push(url);
    const siguiente = respuestas.shift();
    if (!siguiente) throw new Error('sin respuesta simulada');
    if (siguiente instanceof Error) throw siguiente;
    return siguiente;
  }) as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  nav.restaurar();
  spyOn(api, 'obtenerPerfil').mockRestore();
  globalThis.fetch = fetchOriginal;
  process.env.PUBLIC_API_URL = apiOriginal;
});

describe('TableroTareas (US-008)', () => {
  test('Esc 1-2: muestra las tarjetas en el orden recibido con sus datos', async () => {
    // Given: el backend entrega dos tareas, la más reciente primero
    respuestas = [json(pagina([tarea(2), tarea(1)]))];
    // When: el afiliado abre el tablero
    render(<TableroTareas />);
    // Then: cada tarjeta muestra título, categoría, ubicación y fecha
    await screen.findByText('Tarea 2');
    const titulos = screen
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(titulos).toEqual(['Tarea 2', 'Tarea 1']);
    expect(screen.getAllByText('Limpieza')).toHaveLength(2);
    expect(screen.getByText(/Barrio 2/)).toBeTruthy();
    expect(screen.getAllByText(/mar|15/i).length).toBeGreaterThan(0);
    expect(urls[0]).toContain('/api/tareas?pagina=1&limite=12');
    expect(screen.getByRole('button', { name: 'Buscar por zona' })).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Ver todas' }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });

  test('Esc 4: sin tareas muestra el mensaje de tablero vacío', async () => {
    // Given: el backend no tiene tareas abiertas
    respuestas = [json(pagina([]))];
    // When: el afiliado abre el tablero
    render(<TableroTareas />);
    // Then: aparece el mensaje del estado vacío
    expect(await screen.findByText(MENSAJE_TABLERO_VACIO)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('Esc 5: carga el siguiente bloque y lo agrega al final', async () => {
    // Given: una primera página con más resultados disponibles
    respuestas = [
      json(pagina([tarea(1)], true, 1)),
      json(pagina([tarea(2)], false, 2)),
    ];
    render(<TableroTareas />);
    await screen.findByText('Tarea 1');
    // When: el afiliado pide más tareas
    fireEvent.click(screen.getByRole('button', { name: /Cargar más tareas/i }));
    // Then: se pide la página 2 y se agrega sin perder la anterior
    await screen.findByText('Tarea 2');
    expect(screen.getByText('Tarea 1')).toBeTruthy();
    expect(urls[1]).toContain('pagina=2');
    expect(
      screen.queryByRole('button', { name: /Cargar más tareas/i })
    ).toBeNull();
  });

  test('Esc 6: error de red muestra el mensaje y permite reintentar', async () => {
    // Given: el servidor no responde
    respuestas = [new Error('offline'), json(pagina([tarea(1)]))];
    render(<TableroTareas />);
    // When: falla la carga
    const alerta = await screen.findByRole('alert');
    // Then: se muestra el mensaje de la historia y el botón de reintento
    expect(alerta.textContent).toContain(MENSAJE_ERROR_TABLERO);
    // When: el afiliado reintenta
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/i }));
    // Then: se carga el tablero y desaparece el error
    await screen.findByText('Tarea 1');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('Esc 6: un error al cargar un bloque conserva la lista y reintenta ese bloque', async () => {
    // Given: la página 1 carga y la 2 falla
    respuestas = [
      json(pagina([tarea(1)], true, 1)),
      new Error('offline'),
      json(pagina([tarea(2)], false, 2)),
    ];
    render(<TableroTareas />);
    await screen.findByText('Tarea 1');
    fireEvent.click(screen.getByRole('button', { name: /Cargar más tareas/i }));
    // When: falla el segundo bloque
    await screen.findByRole('alert');
    // Then: la primera tarea sigue visible
    expect(screen.getByText('Tarea 1')).toBeTruthy();
    // When: se reintenta
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/i }));
    // Then: se pide otra vez la página 2
    await screen.findByText('Tarea 2');
    expect(urls[2]).toContain('pagina=2');
  });

  test('un 401 redirige al login con aviso de sesión expirada', async () => {
    // Given: el backend responde 401
    respuestas = [json({ message: 'Sesión inválida o expirada.' }, 401)];
    // When: se abre el tablero
    render(<TableroTareas />);
    // Then: redirige a /login?expirada=1
    await waitFor(() => expect(nav.destino()).toBe('/login?expirada=1'));
  });

  test('sin sesión invita a iniciar sesión y no llama al backend', async () => {
    // Given: no hay token guardado
    localStorage.removeItem('ch-token');
    // When: se abre el tablero
    render(<TableroTareas />);
    // Then: invita a iniciar sesión y no hay peticiones
    await screen.findByRole('link', { name: /Iniciar sesión/i });
    expect(urls).toHaveLength(0);
  });

  test('un cliente ve el aviso de exclusividad y no se piden tareas', async () => {
    // Given: una sesión de cliente
    (
      api.obtenerPerfil as unknown as ReturnType<typeof spyOn>
    ).mockResolvedValue(CLIENTE);
    // When: abre el tablero
    render(<TableroTareas />);
    // Then: aviso de exclusividad, sin filtro ni peticiones de tareas
    expect(await screen.findByText(new RegExp(MENSAJE_SOLO_AFILIADOS))).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Buscar por zona' })).toBeNull();
    expect(urls).toHaveLength(0);
  });

  test('si falla el perfil muestra el error y permite reintentar', async () => {
    // Given: el perfil no se puede cargar
    (
      api.obtenerPerfil as unknown as ReturnType<typeof spyOn>
    ).mockRejectedValueOnce(new Error('offline'));
    respuestas = [json(pagina([tarea(1)]))];
    render(<TableroTareas />);
    // Then: alerta con reintento
    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toContain(MENSAJE_ERROR_PERFIL);
    // When: el backend se recupera y se reintenta
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/i }));
    // Then: se carga el tablero
    await screen.findByText('Tarea 1');
  });

  test('un 401 al cargar el perfil redirige al login', async () => {
    // Given: la sesión ya expiró
    (
      api.obtenerPerfil as unknown as ReturnType<typeof spyOn>
    ).mockRejectedValue(new api.ErrorSesionExpirada());
    render(<TableroTareas />);
    // Then: redirige a /login?expirada=1
    await waitFor(() => expect(nav.destino()).toBe('/login?expirada=1'));
  });

  test('la URL con filtro se lee al montar y muestra la banda y la distancia', async () => {
    // Given: una URL con filtro válido
    nav.restaurar();
    nav = simularNavegacion('?lat=6.2&lng=-75.5&radio=5');
    respuestas = [
      json(pagina([tarea(1, { latitud: 6.21, longitud: -75.5 })])),
    ];
    // When: se abre el tablero
    render(<TableroTareas />);
    // Then: la primera petición lleva el filtro y se muestra la banda
    await screen.findByText('Tarea 1');
    expect(urls[0]).toContain('lat=6.2');
    expect(urls[0]).toContain('lng=-75.5');
    expect(urls[0]).toContain('radio=5');
    expect(screen.getByText(/Buscando en un radio de 5 km/)).toBeTruthy();
    expect(screen.getByText(/^a /)).toBeTruthy();
  });

  test('una URL inválida se limpia y carga sin filtro', async () => {
    // Given: una URL con parámetros incompletos
    nav.restaurar();
    nav = simularNavegacion('?lat=6.2');
    respuestas = [json(pagina([tarea(1)]))];
    // When: se abre el tablero
    render(<TableroTareas />);
    // Then: no se envía el filtro ni aparece la banda
    await screen.findByText('Tarea 1');
    expect(urls[0]).not.toContain('lat=');
    expect(screen.queryByText(/Buscando en un radio/)).toBeNull();
  });

  test('"Ver todas" limpia el filtro y recarga sin parámetros', async () => {
    // Given: un tablero filtrado
    nav.restaurar();
    nav = simularNavegacion('?lat=6.2&lng=-75.5&radio=5');
    respuestas = [
      json(pagina([tarea(1, { latitud: 6.2, longitud: -75.5 })])),
      json(pagina([tarea(2)])),
    ];
    render(<TableroTareas />);
    await screen.findByText('Tarea 1');
    // When: pulsa "Ver todas"
    fireEvent.click(screen.getByRole('button', { name: 'Ver todas' }));
    // Then: recarga sin filtro
    await screen.findByText('Tarea 2');
    expect(urls[1]).not.toContain('lat=');
    expect(screen.queryByText(/Buscando en un radio/)).toBeNull();
  });

  test('"Buscar por zona" abre el diálogo y "Cancelar" lo cierra', async () => {
    // Given: un tablero cargado
    respuestas = [json(pagina([tarea(1)]))];
    render(<TableroTareas />);
    await screen.findByText('Tarea 1');
    // When: abre el buscador
    fireEvent.click(screen.getByRole('button', { name: 'Buscar por zona' }));
    // Then: aparece el diálogo
    expect(
      await screen.findByRole('dialog', { name: 'Buscar por zona' })
    ).toBeTruthy();
    // When: cancela
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    // Then: se cierra sin tocar el filtro
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Buscar por zona' })).toBeNull()
    );
  });

  test('US-009 Esc 1: "Ver" lleva a la página de detalle de esa tarea', async () => {
    // Given: un tablero con dos tareas
    respuestas = [json(pagina([tarea(1), tarea(2)]))];
    render(<TableroTareas />);
    await screen.findByText('Tarea 1');
    // When: se miran los enlaces de detalle
    const enlaces = screen.getAllByRole('link', { name: 'Ver' });
    // Then: cada tarjeta enlaza a su propia página de detalle
    expect(enlaces.map((e) => e.getAttribute('href'))).toEqual([
      '/tareas/detalle?id=t-1',
      '/tareas/detalle?id=t-2',
    ]);
  });

  test('clic en la tarjeta navega al detalle', async () => {
    // Given: una tarjeta
    respuestas = [json(pagina([tarea(1)]))];
    render(<TableroTareas />);
    const titulo = await screen.findByText('Tarea 1');
    // When: se hace clic en el cuerpo de la tarjeta
    fireEvent.click(titulo);
    // Then: navega al detalle de esa tarea
    expect(nav.destino()).toBe('/tareas/detalle?id=t-1');
  });
});

describe('TableroTareas: scroll infinito', () => {
  const ioOriginal = Object.getOwnPropertyDescriptor(
    globalThis,
    'IntersectionObserver'
  );
  type Aviso = (entradas: Array<{ isIntersecting: boolean }>) => void;
  let avisos: Aviso[];

  beforeEach(() => {
    avisos = [];
    Object.defineProperty(globalThis, 'IntersectionObserver', {
      configurable: true,
      writable: true,
      value: class {
        constructor(cb: Aviso) {
          avisos.push(cb);
        }
        observe() {}
        disconnect() {}
      },
    });
  });

  afterEach(() => {
    if (ioOriginal)
      Object.defineProperty(globalThis, 'IntersectionObserver', ioOriginal);
    else
      delete (globalThis as { IntersectionObserver?: unknown })
        .IntersectionObserver;
  });

  test('Esc 5: al llegar al final (centinela visible) carga el siguiente bloque', async () => {
    // Given: una primera página con más resultados y un observador de scroll
    respuestas = [
      json(pagina([tarea(1)], true, 1)),
      json(pagina([tarea(2)], false, 2)),
    ];
    render(<TableroTareas />);
    await screen.findByText('Tarea 1');
    // El observador se registra en un efecto posterior al primer pintado.
    await waitFor(() => expect(avisos.length).toBeGreaterThan(0));
    const avisar = avisos[avisos.length - 1]!;
    // When: el centinela aún no es visible
    act(() => avisar([{ isIntersecting: false }]));
    // Then: no se pide nada más
    expect(urls).toHaveLength(1);
    // When: el centinela llega a la pantalla
    act(() => avisar([{ isIntersecting: true }]));
    // Then: se carga y agrega la página siguiente
    await screen.findByText('Tarea 2');
    expect(urls[1]).toContain('pagina=2');
  });
});
