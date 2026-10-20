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
    expect(() => initThemeToggle()).not.toThrow();
  });

  test('alterna el tema, lo persiste y actualiza aria', () => {
    document.body.innerHTML = '<button id="ch-theme-toggle"></button>';
    initThemeToggle();
    const btn = document.getElementById('ch-theme-toggle')!;
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(btn.getAttribute('aria-label')).toBe('Cambiar a tema oscuro');

    btn.click();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('ch-theme')).toBe('dark');
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(btn.getAttribute('aria-label')).toBe('Cambiar a tema claro');

    btn.click();
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  test('sigue funcionando si localStorage lanza', () => {
    document.body.innerHTML = '<button id="ch-theme-toggle"></button>';
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('bloqueado');
    };
    try {
      initThemeToggle();
      document.getElementById('ch-theme-toggle')!.click();
      expect(document.documentElement.dataset.theme).toBe('dark');
    } finally {
      Storage.prototype.setItem = original;
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
    expect(() => initLandingReveal()).not.toThrow();
  });

  test('con reduced-motion muestra todo de inmediato', () => {
    document.body.innerHTML = html;
    window.matchMedia = (() => ({ matches: true })) as never;
    initLandingReveal();
    expect(document.querySelectorAll('.is-visible')).toHaveLength(2);
  });

  test('sin IntersectionObserver muestra todo', () => {
    document.body.innerHTML = html;
    window.matchMedia = (() => ({ matches: false })) as never;
    delete win.IntersectionObserver;
    initLandingReveal();
    expect(document.querySelectorAll('.is-visible')).toHaveLength(2);
  });

  test('observa y revela al intersectar, una sola vez', () => {
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
    initLandingReveal();
    expect(observados).toHaveLength(2);
    expect(observados[0]!.classList.contains('lp-reveal')).toBe(true);

    callback([
      { isIntersecting: false, target: observados[0] },
      { isIntersecting: true, target: observados[1] },
    ]);
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
    document.body.innerHTML = html;
    const originalTimeout = window.setTimeout;
    let reintentos = 0;
    window.setTimeout = ((fn: () => void) => {
      reintentos++;
      fn();
      return 0;
    }) as never;
    try {
      initNavAuth();
    } finally {
      window.setTimeout = originalTimeout;
    }
    expect(reintentos).toBeGreaterThan(100);
    expect(out().hidden).toBe(false);
    expect(dentro().hidden).toBe(true);
  });

  test('con sesión muestra "in", suscribe cambios y re-sincroniza', () => {
    document.body.innerHTML = html;
    let oyente: () => void = () => {};
    win.Clerk = {
      loaded: true,
      session: { id: 's' },
      addListener: (cb: () => void) => {
        oyente = cb;
      },
    };
    initNavAuth();
    expect(out().hidden).toBe(true);
    expect(dentro().hidden).toBe(false);

    (win.Clerk as { session: unknown }).session = null;
    oyente();
    expect(out().hidden).toBe(false);
    expect(dentro().hidden).toBe(true);
  });

  test('tolera que addListener lance', () => {
    document.body.innerHTML = html;
    win.Clerk = {
      loaded: true,
      addListener: () => {
        throw new Error('sin suscripción');
      },
    };
    expect(() => initNavAuth()).not.toThrow();
  });

  test('el botón de salida cierra sesión, limpia y redirige', async () => {
    document.body.innerHTML = html;
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
    dentro().click();
    await new Promise((r) => setTimeout(r, 0));
    expect(cerrada).toBe(true);
    expect(sessionStorage.getItem('x')).toBeNull();
    expect(dentro().disabled).toBe(false);
  });

  test('ignora clics mientras está deshabilitado', () => {
    document.body.innerHTML = html;
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
    dentro().dispatchEvent(new Event('click'));
    expect(llamadas).toBe(0);
  });
});
