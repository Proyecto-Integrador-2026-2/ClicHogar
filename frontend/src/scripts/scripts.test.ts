/**
 * Pruebas de los scripts de navegador (tema, reveal, ranura de auth) sobre
 * el DOM de happy-dom.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { initLandingReveal } from './landing-reveal';
import { initNavAuth } from './nav-auth';
import { initThemeToggle } from './theme-toggle';

type Win = Record<string, unknown>;
const win = window as unknown as Win;

beforeEach(() => {
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-theme');
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  delete win.Clerk;
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

describe('initNavAuth', () => {
  const html = `
    <a data-nav-auth="out">Crear cuenta</a>
    <button data-nav-auth="in" data-logout>Salir</button>`;
  const out = () => document.querySelector<HTMLElement>('[data-nav-auth=out]')!;
  const dentro = () =>
    document.querySelector<HTMLButtonElement>('[data-logout]')!;

  test('sin Clerk muestra la ranura "out" y reintenta hasta rendirse', async () => {
    // Given: una página sin window.Clerk
    document.body.innerHTML = html;
    const originalTimeout = window.setTimeout;
    let reintentos = 0;
    window.setTimeout = ((fn: () => void) => {
      reintentos++;
      fn();
      return 0;
    }) as never;
    // When: se inicializa la ranura de auth
    try {
      initNavAuth();
    } finally {
      window.setTimeout = originalTimeout;
    }
    // Then: reintenta hasta rendirse y muestra la ranura 'out'
    expect(reintentos).toBeGreaterThan(100);
    expect(out().hidden).toBe(false);
    expect(dentro().hidden).toBe(true);
  });

  test('con sesión muestra "in", suscribe cambios y re-sincroniza', () => {
    document.body.innerHTML = html;
    let oyente: () => void = () => {};
    // Given: un Clerk cargado, con sesión y suscripción a cambios
    win.Clerk = {
      loaded: true,
      session: { id: 's' },
      addListener: (cb: () => void) => {
        oyente = cb;
      },
    };
    // When: se inicializa la ranura de auth
    initNavAuth();
    // Then: se muestra la ranura 'in' y se oculta la 'out'
    expect(out().hidden).toBe(true);
    expect(dentro().hidden).toBe(false);

    (win.Clerk as { session: unknown }).session = null;
    // When: la sesión se cierra y Clerk avisa
    oyente();
    // Then: se vuelve a mostrar la ranura 'out'
    expect(out().hidden).toBe(false);
    expect(dentro().hidden).toBe(true);
  });

  test('tolera que addListener lance', () => {
    document.body.innerHTML = html;
    // Given: un Clerk cuyo addListener lanza un error
    win.Clerk = {
      loaded: true,
      addListener: () => {
        throw new Error('sin suscripción');
      },
    };
    // When: se inicializa la ranura de auth
    // Then: no lanza: sigue con el último estado
    expect(() => initNavAuth()).not.toThrow();
  });

  test('el botón de salida cierra sesión, limpia y redirige', async () => {
    document.body.innerHTML = html;
    // Given: un Clerk con sesión, signOut y datos en sessionStorage
    sessionStorage.setItem('x', '1');
    let cerrada = false;
    win.Clerk = {
      loaded: true,
      session: {},
      signOut: async () => {
        cerrada = true;
      },
    };
    initNavAuth();
    // When: se hace clic en el botón de salida
    dentro().click();
    await new Promise((r) => setTimeout(r, 0));
    // Then: cierra sesión, limpia sessionStorage y rehabilita el botón
    expect(cerrada).toBe(true);
    expect(sessionStorage.getItem('x')).toBeNull();
    expect(dentro().disabled).toBe(false);
  });

  test('ignora clics mientras está deshabilitado', () => {
    document.body.innerHTML = html;
    // Given: un Clerk con sesión y signOut contado
    let llamadas = 0;
    win.Clerk = {
      loaded: true,
      session: {},
      signOut: async () => {
        llamadas++;
      },
    };
    initNavAuth();
    dentro().disabled = true;
    // When: se hace clic con el botón deshabilitado
    dentro().dispatchEvent(new Event('click'));
    // Then: no se llama a signOut
    expect(llamadas).toBe(0);
  });
});
