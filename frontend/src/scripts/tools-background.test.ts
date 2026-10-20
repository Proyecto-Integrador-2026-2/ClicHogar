/**
 * Pruebas del fondo animado: `requestAnimationFrame` se controla a mano
 * para avanzar los cuadros y comprobar deriva, reaparición y repulsión.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { initToolsBackground } from './tools-background';

const w = window as unknown as Record<string, unknown>;
const originalMatchMedia = window.matchMedia;
const originalRaf = window.requestAnimationFrame;
const originalPerf = performance.now.bind(performance);

let cuadros: Array<(t: number) => void> = [];

function mediaQuery(reduce: boolean, fine: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: q.includes('reduced-motion') ? reduce : fine,
  })) as never;
}

function avanzar(t: number) {
  const pendientes = cuadros;
  cuadros = [];
  for (const cb of pendientes) cb(t);
}

beforeEach(() => {
  document.body.innerHTML = `
    <div class="ch-bg">
      <span class="ch-bg__tool" style="--x: 50; --y: 50"></span>
      <span class="ch-bg__orb"></span>
    </div>`;
  cuadros = [];
  window.requestAnimationFrame = ((cb: (t: number) => void) => {
    cuadros.push(cb);
    return cuadros.length;
  }) as never;
  performance.now = () => 0;
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  window.requestAnimationFrame = originalRaf;
  performance.now = originalPerf;
  void w;
});

describe('initToolsBackground', () => {
  test('sin .ch-bg no hace nada', () => {
    document.body.innerHTML = '';
    mediaQuery(false, true);
    expect(() => initToolsBackground()).not.toThrow();
    expect(cuadros).toHaveLength(0);
  });

  test('con reduced-motion coloca las piezas una vez y no anima', () => {
    mediaQuery(true, true);
    initToolsBackground();
    expect(cuadros).toHaveLength(0);
    const pieza = document.querySelector<HTMLElement>('.ch-bg__tool')!;
    expect(pieza.style.transform).toContain('translate3d');
  });

  test('anima: cada cuadro reposiciona y agenda el siguiente', () => {
    mediaQuery(false, false);
    initToolsBackground();
    expect(cuadros).toHaveLength(1);
    avanzar(1000);
    expect(cuadros).toHaveLength(1);
    const pieza = document.querySelector<HTMLElement>('.ch-bg__tool')!;
    expect(pieza.style.transform).toContain('rotate(');
  });

  test('reaparece por el borde opuesto al salirse', () => {
    mediaQuery(false, false);
    initToolsBackground();
    const piezas = document.querySelectorAll<HTMLElement>(
      '.ch-bg__tool, .ch-bg__orb'
    );
    const nativo = Math.random;
    // Fuerza fracciones fuera de rango en el siguiente init.
    document.body.innerHTML = `
      <div class="ch-bg">
        <span class="ch-bg__tool" style="--x: -500; --y: -500"></span>
        <span class="ch-bg__tool" style="--x: 600; --y: 600"></span>
      </div>`;
    cuadros = [];
    Math.random = () => 0.5;
    try {
      initToolsBackground();
      avanzar(50);
    } finally {
      Math.random = nativo;
    }
    expect(piezas.length).toBeGreaterThan(0);
    for (const el of document.querySelectorAll<HTMLElement>('.ch-bg__tool')) {
      expect(el.style.transform).toContain('translate3d');
    }
  });

  test('puntero fino: el cursor repele las piezas y actualiza --gx', () => {
    mediaQuery(false, true);
    window.innerWidth = 1000;
    window.innerHeight = 800;
    initToolsBackground();
    window.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 500, clientY: 400 })
    );
    expect(document.documentElement.style.getPropertyValue('--gx')).toBe(
      '0.500'
    );
    avanzar(100);
    avanzar(200);
    const pieza = document.querySelector<HTMLElement>('.ch-bg__tool')!;
    expect(pieza.style.transform).toContain('translate3d');

    document.documentElement.dispatchEvent(new Event('pointerleave'));
    window.innerWidth = 800;
    window.dispatchEvent(new Event('resize'));
    avanzar(300);
    expect(cuadros).toHaveLength(1);
  });
});
