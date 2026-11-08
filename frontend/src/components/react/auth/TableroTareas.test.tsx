/**
 * Pruebas del tablero de tareas (US-008). `fetch` se simula: sin red ni
 * backend. Cada prueba mapea a un escenario de aceptación.
 */
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import React from 'react';
import { simularNavegacion } from '../../../../test-setup';
import TableroTareas, {
  MENSAJE_ERROR_TABLERO,
  MENSAJE_TABLERO_VACIO,
} from './TableroTareas';

const fetchOriginal = globalThis.fetch;
const apiOriginal = process.env.PUBLIC_API_URL;

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

beforeEach(() => {
  process.env.PUBLIC_API_URL = 'http://api.test';
  localStorage.setItem('ch-token', 'token-falso');
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
  globalThis.fetch = fetchOriginal;
  process.env.PUBLIC_API_URL = apiOriginal;
  localStorage.setItem('ch-token', 'token-falso');
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
    const nav = simularNavegacion();
    respuestas = [json({ message: 'Sesión inválida o expirada.' }, 401)];
    try {
      // When: se abre el tablero
      render(<TableroTareas />);
      // Then: redirige a /login?expirada=1
      await waitFor(() => expect(nav.destino()).toBe('/login?expirada=1'));
    } finally {
      nav.restaurar();
    }
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

  test('filtro por cercanía: valida, aplica desde la página 1 y se limpia', async () => {
    // Given: el tablero cargado
    respuestas = [
      json(pagina([tarea(1)])),
      json(pagina([tarea(3)])),
      json(pagina([tarea(1)])),
    ];
    render(<TableroTareas />);
    await screen.findByText('Tarea 1');
    // When: filtra con coordenadas vacías
    fireEvent.change(screen.getByLabelText('Radio en kilómetros'), {
      target: { value: '' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /Filtrar por cercanía/i })
    );
    // Then: avisa y no pide nada
    expect((await screen.findByRole('alert')).textContent).toContain('válidos');
    expect(urls).toHaveLength(1);
    // When: filtra con datos válidos
    fireEvent.change(screen.getByLabelText('Latitud'), {
      target: { value: '6.2' },
    });
    fireEvent.change(screen.getByLabelText('Longitud'), {
      target: { value: '-75.5' },
    });
    fireEvent.change(screen.getByLabelText('Radio en kilómetros'), {
      target: { value: '5' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /Filtrar por cercanía/i })
    );
    // Then: pide la página 1 con el filtro y muestra solo el resultado
    await screen.findByText('Tarea 3');
    expect(urls[1]).toContain('pagina=1');
    expect(urls[1]).toContain('lat=6.2');
    expect(urls[1]).toContain('lng=-75.5');
    expect(urls[1]).toContain('radio=5');
    expect(screen.queryByText('Tarea 1')).toBeNull();
    // When: limpia el filtro
    fireEvent.click(screen.getByRole('button', { name: /Limpiar/i }));
    // Then: vuelve al tablero sin filtro
    await screen.findByText('Tarea 1');
    expect(urls[2]).not.toContain('lat=');
  });

  test('el filtro sin resultados explica que no hay tareas en ese radio', async () => {
    // Given: un tablero cargado y un filtro que no devuelve nada
    respuestas = [json(pagina([tarea(1)])), json(pagina([]))];
    render(<TableroTareas />);
    await screen.findByText('Tarea 1');
    fireEvent.change(screen.getByLabelText('Latitud'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('Longitud'), {
      target: { value: '1' },
    });
    // When: se aplica el filtro
    fireEvent.click(
      screen.getByRole('button', { name: /Filtrar por cercanía/i })
    );
    // Then: se explica en vez de mostrar el mensaje de tablero vacío
    expect(await screen.findByText(/dentro de ese radio/i)).toBeTruthy();
    expect(screen.queryByText(MENSAJE_TABLERO_VACIO)).toBeNull();
  });

  test('Ver detalle abre y cierra el modal de la tarea', async () => {
    // Given: un tablero con una tarea sin coordenadas y el perfil del autor
    respuestas = [
      json(pagina([tarea(1)])),
      json({ id: 'u-1', nombre: 'Ana', descripcion: 'Hola', ubicacion: null }),
    ];
    render(<TableroTareas />);
    await screen.findByText('Tarea 1');
    // When: se abre el detalle
    fireEvent.click(screen.getByRole('button', { name: /Ver detalle/i }));
    // Then: aparece el modal con el autor y sin mapa
    const modal = await screen.findByRole('dialog');
    expect(modal.textContent).toContain('Sin ubicación exacta.');
    await waitFor(() => expect(modal.textContent).toContain('Autor: Ana'));
    // When: se cierra
    fireEvent.click(screen.getByRole('button', { name: /Cerrar/i }));
    // Then: el modal desaparece
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('TableroTareas: scroll infinito y mapa del detalle', () => {
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

  test('el detalle con coordenadas dibuja el mapa y se limpia al cerrar', async () => {
    // Given: una tarea con coordenadas y el perfil del autor
    respuestas = [
      json(pagina([tarea(1, { latitud: 6.2, longitud: -75.5 })])),
      json({
        id: 'u-1',
        nombre: 'Ana',
        descripcion: null,
        ubicacion: 'Laureles',
      }),
    ];
    render(<TableroTareas />);
    await screen.findByText('Tarea 1');
    // When: se abre el detalle
    fireEvent.click(screen.getByRole('button', { name: /Ver detalle/i }));
    // Then: aparece el mapa de Leaflet con el autor y su ubicación
    const modal = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(modal.querySelector('.leaflet-container')).not.toBeNull()
    );
    await waitFor(() => expect(modal.textContent).toContain('Laureles'));
    expect(modal.textContent).not.toContain('Sin ubicación exacta.');
    // When: se cierra
    fireEvent.click(screen.getByRole('button', { name: /Cerrar/i }));
    // Then: el modal desaparece
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('si el perfil del autor falla, el detalle se muestra sin él', async () => {
    // Given: un detalle cuyo perfil de autor no se puede cargar
    respuestas = [json(pagina([tarea(1)])), json({ message: 'No' }, 500)];
    render(<TableroTareas />);
    await screen.findByText('Tarea 1');
    // When: se abre el detalle
    fireEvent.click(screen.getByRole('button', { name: /Ver detalle/i }));
    // Then: el modal aparece sin la línea de autor
    const modal = await screen.findByRole('dialog');
    await waitFor(() => expect(urls).toHaveLength(2));
    expect(modal.textContent).not.toContain('Autor:');
  });
});
