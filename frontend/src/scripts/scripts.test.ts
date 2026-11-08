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
