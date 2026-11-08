/**
 * Pruebas de los scripts de navegador (tema, reveal, ranura de auth) sobre
 * el DOM de happy-dom.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { simularNavegacion } from '../../test-setup';
import {
  borrarToken,
  estaFirmado,
  guardarToken,
  obtenerToken,
} from '../lib/auth';
import { initAuthGuard } from './auth-guard';
import { initLandingReveal } from './landing-reveal';
import { apiUrl, initNavAuth } from './nav-auth';
import { initThemeToggle } from './theme-toggle';

type Win = Record<string, unknown>;
const win = window as unknown as Win;

beforeEach(() => {
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-theme');
  localStorage.clear();
  sessionStorage.clear();
});

describe('initThemeToggle', () => {
  test('no hace nada sin botón', () => {
    // Given: una página sin botón de tema
    // When: se inicializa el toggle
    // Then: no hace nada ni lanza errores
    expect(() => initThemeToggle()).not.toThrow();
  });

  test('alterna el tema, lo persiste y actualiza aria', () => {
    // Given: una página con el botón de tema
    document.body.innerHTML = '<button id="ch-theme-toggle"></button>';
    // When: se inicializa el toggle
    initThemeToggle();
    const btn = document.getElementById('ch-theme-toggle')!;
    // Then: el botón arranca en tema claro
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(btn.getAttribute('aria-label')).toBe('Cambiar a tema oscuro');

    // When: se hace clic
    btn.click();
    // Then: el tema pasa a oscuro, se guarda y se actualiza aria
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('ch-theme')).toBe('dark');
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(btn.getAttribute('aria-label')).toBe('Cambiar a tema claro');

    // When: se hace clic otra vez
    btn.click();
    // Then: vuelve al tema claro
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  test('sigue funcionando si localStorage lanza', () => {
    document.body.innerHTML = '<button id="ch-theme-toggle"></button>';
    // Given: un navegador que bloquea el acceso a localStorage
    const original = Object.getOwnPropertyDescriptor(
      globalThis,
      'localStorage'
    );
    let intentos = 0;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        intentos++;
        throw new Error('bloqueado');
      },
    });
    try {
      initThemeToggle();
      // When: se hace clic en el botón
      document.getElementById('ch-theme-toggle')!.click();
      // Then: se intentó guardar y falló, pero el tema cambia igual en la sesión
      expect(intentos).toBe(1);
      expect(document.documentElement.dataset.theme).toBe('dark');
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original);
    }
  });
});

describe('initLandingReveal', () => {
  const html = '<p data-reveal></p><p data-reveal></p>';
  const originalMatchMedia = window.matchMedia;
  const originalIO = (window as unknown as Win).IntersectionObserver;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    win.IntersectionObserver = originalIO;
  });

  test('sin elementos no hace nada', () => {
    // Given: una página sin elementos [data-reveal]
    // When: se inicializa el reveal
    // Then: no hace nada ni lanza errores
    expect(() => initLandingReveal()).not.toThrow();
  });

  test('con reduced-motion muestra todo de inmediato', () => {
    // Given: dos elementos y la preferencia reduced-motion activa
    document.body.innerHTML = html;
    window.matchMedia = (() => ({ matches: true })) as never;
    // When: se inicializa el reveal
    initLandingReveal();
    // Then: ambos se muestran de inmediato
    expect(document.querySelectorAll('.is-visible')).toHaveLength(2);
  });

  test('sin IntersectionObserver muestra todo', () => {
    // Given: dos elementos y un navegador sin IntersectionObserver
    document.body.innerHTML = html;
    window.matchMedia = (() => ({ matches: false })) as never;
    delete win.IntersectionObserver;
    // When: se inicializa el reveal
    initLandingReveal();
    // Then: ambos se muestran de inmediato
    expect(document.querySelectorAll('.is-visible')).toHaveLength(2);
  });

  test('observa y revela al intersectar, una sola vez', () => {
    // Given: dos elementos y un IntersectionObserver falso
    document.body.innerHTML = html;
    window.matchMedia = (() => ({ matches: false })) as never;
    const observados: Element[] = [];
    const quitados: Element[] = [];
    let callback: (entries: unknown[]) => void = () => {};
    win.IntersectionObserver = class {
      constructor(cb: (entries: unknown[]) => void) {
        callback = cb;
      }
      observe(el: Element) {
        observados.push(el);
      }
      unobserve(el: Element) {
        quitados.push(el);
      }
    };
    // When: se inicializa el reveal
    initLandingReveal();
    // Then: se observan ambos y se les añade la clase lp-reveal
    expect(observados).toHaveLength(2);
    expect(observados[0]!.classList.contains('lp-reveal')).toBe(true);

    // When: el observador reporta que solo el segundo intersecta
    callback([
      { isIntersecting: false, target: observados[0] },
      { isIntersecting: true, target: observados[1] },
    ]);
    // Then: solo el segundo se revela y se deja de observar
    expect(observados[0]!.classList.contains('is-visible')).toBe(false);
    expect(observados[1]!.classList.contains('is-visible')).toBe(true);
    expect(quitados).toEqual([observados[1]!]);
  });
});

describe('lib/auth (token en localStorage)', () => {
  test('guarda, lee y borra el token', () => {
    // Given: un navegador sin token
    expect(obtenerToken()).toBeNull();
    expect(estaFirmado()).toBe(false);
    // When: se guarda un token
    guardarToken('abc');
    // Then: se puede leer y la sesión figura firmada
    expect(obtenerToken()).toBe('abc');
    expect(estaFirmado()).toBe(true);
    // When: se borra
    borrarToken();
    // Then: vuelve a quedar sin sesión
    expect(estaFirmado()).toBe(false);
  });

  test('sin window (servidor) no hace nada', () => {
    // Given: un entorno sin window
    const original = globalThis.window;
    // @ts-expect-error simula el render en servidor
    delete globalThis.window;
    try {
      // When: se usan las funciones de token
      // Then: no lanzan y no devuelven token
      expect(obtenerToken()).toBeNull();
      expect(() => guardarToken('x')).not.toThrow();
      expect(() => borrarToken()).not.toThrow();
    } finally {
      globalThis.window = original;
    }
  });
});

describe('initAuthGuard', () => {
  test('sin token redirige al login; con token no hace nada', () => {
    const nav = simularNavegacion();
    try {
      // Given: un navegador sin token
      // When: se inicializa el guard
      initAuthGuard();
      // Then: redirige a /login
      expect(nav.destino()).toBe('/login');
    } finally {
      nav.restaurar();
    }
    const nav2 = simularNavegacion();
    try {
      // Given: un navegador con token
      localStorage.setItem('ch-token', 'abc');
      // When: se inicializa el guard
      initAuthGuard();
      // Then: no redirige
      expect(nav2.destino()).toBe('');
    } finally {
      nav2.restaurar();
    }
  });
});

describe('initNavAuth', () => {
  const html =
    '<a data-nav-auth="in" id="dentro">Panel</a>' +
    '<a data-nav-auth="out" id="fuera">Entrar</a>' +
    '<button data-logout id="salir">Salir</button>';
  const fetchOriginal = globalThis.fetch;
  let llamadas: Array<{ url: string; init?: RequestInit }>;

  beforeEach(() => {
    document.body.innerHTML = html;
    llamadas = [];
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      llamadas.push({ url, init });
      return new Response('{}');
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
  });

  test('sin sesión muestra "out" y oculta "in"', () => {
    // Given: un navegador sin token
    // When: se inicializa la barra
    initNavAuth();
    // Then: se ve el acceso a entrar y se oculta el panel
    expect(document.getElementById('dentro')!.hidden).toBe(true);
    expect(document.getElementById('fuera')!.hidden).toBe(false);
  });

  test('con sesión muestra "in" y oculta "out"', () => {
    // Given: un navegador con token
    localStorage.setItem('ch-token', 'abc');
    // When: se inicializa la barra
    initNavAuth();
    // Then: se ve el panel y se oculta el acceso a entrar
    expect(document.getElementById('dentro')!.hidden).toBe(false);
    expect(document.getElementById('fuera')!.hidden).toBe(true);
  });

  test('cerrar sesión avisa al backend, limpia el token y va al login', async () => {
    // Given: una sesión abierta y un backend disponible
    localStorage.setItem('ch-token', 'abc');
    sessionStorage.setItem('x', '1');
    const nav = simularNavegacion();
    try {
      initNavAuth();
      // When: se pulsa Salir (dos veces: la segunda se ignora mientras se cierra)
      const boton = document.getElementById('salir') as HTMLButtonElement;
      boton.click();
      boton.click();
      await new Promise((r) => setTimeout(r, 0));
      // Then: llama al logout con el token, limpia todo y redirige
      expect(llamadas).toHaveLength(1);
      expect(llamadas[0]!.url).toContain('/api/auth/logout');
      expect(
        (llamadas[0]!.init?.headers as Record<string, string>).Authorization
      ).toBe('Bearer abc');
      expect(localStorage.getItem('ch-token')).toBeNull();
      expect(sessionStorage.getItem('x')).toBeNull();
      expect(nav.destino()).toBe('/login');
    } finally {
      nav.restaurar();
    }
  });

  test('si el backend no responde igual cierra la sesión local', async () => {
    // Given: una sesión abierta y un backend caído
    localStorage.setItem('ch-token', 'abc');
    globalThis.fetch = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    const nav = simularNavegacion();
    try {
      initNavAuth();
      // When: se pulsa Salir
      document.getElementById('salir')!.click();
      await new Promise((r) => setTimeout(r, 0));
      // Then: borra el token y redirige igualmente
      expect(localStorage.getItem('ch-token')).toBeNull();
      expect(nav.destino()).toBe('/login');
    } finally {
      nav.restaurar();
    }
  });

  test('sin token no llama al backend al salir', async () => {
    // Given: un botón de salir sin sesión
    const nav = simularNavegacion();
    try {
      initNavAuth();
      // When: se pulsa Salir
      document.getElementById('salir')!.click();
      await new Promise((r) => setTimeout(r, 0));
      // Then: no hay llamada y redirige al login
      expect(llamadas).toHaveLength(0);
      expect(nav.destino()).toBe('/login');
    } finally {
      nav.restaurar();
    }
  });
});

describe('apiUrl', () => {
  const original = process.env.PUBLIC_API_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.PUBLIC_API_URL;
    else process.env.PUBLIC_API_URL = original;
  });

  test('usa PUBLIC_API_URL si existe (no localhost)', () => {
    // Given: PUBLIC_API_URL configurada
    process.env.PUBLIC_API_URL = 'https://api.ejemplo.com';
    // When: se resuelve la URL
    // Then: es la configurada
    expect(apiUrl()).toBe('https://api.ejemplo.com');
  });
});
