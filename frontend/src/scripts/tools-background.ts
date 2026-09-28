/**
 * Fondo vivo de la página de registro: deriva continua de herramientas y
 * orbes por la página + repulsión suave al pasar el cursor.
 *
 * Decisiones de rendimiento: solo `transform` (barato para el compositor),
 * `requestAnimationFrame` con `dt` acotado y pausa automática en pestaña
 * oculta. Con `prefers-reduced-motion` las piezas quedan estáticas.
 * Sin puntero fino (táctil) hay deriva pero no reacción al cursor.
 */

type Pieza = {
  el: HTMLElement;
  /** Posición base en fracción del viewport (0–1, puede salirse). */
  fx: number;
  fy: number;
  /** Velocidad de deriva en px/s. */
  vx: number;
  vy: number;
  /** Desplazamiento elástico actual por repulsión. */
  ox: number;
  oy: number;
  /** Fase para el vaivén. */
  ph: number;
};

/** Lee una custom property `--x`/`--y` (0–100) como fracción, o un fallback. */
function fraccion(el: HTMLElement, nombre: string, fb: number): number {
  const v = parseFloat(el.style.getPropertyValue(nombre));
  return Number.isFinite(v) ? v / 100 : fb;
}

/** Margen de reaparición por el borde opuesto (px). */
const MARGEN = 90;
/** Radio de reacción al cursor (px). */
const RADIO = 150;
/** Empuje máximo de repulsión (px). */
const EMPUJE_MAX = 70;

/** Arranca el motor. Llamar una vez por página (idempotente en la práctica:
 *  cada llamada crea su propio bucle; no llamar dos veces).
 */
export function initToolsBackground(): void {
  const bg = document.querySelector('.ch-bg');
  if (!bg) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(pointer: fine)').matches;

  const piezas: Array<Pieza> = [
    ...bg.querySelectorAll<HTMLElement>('.ch-bg__tool, .ch-bg__orb'),
  ].map((el) => ({
    el,
    fx: fraccion(el, '--x', Math.random()),
    fy: fraccion(el, '--y', Math.random()),
    vx: (Math.random() - 0.5) * 14, // px/s: deriva lenta
    vy: (Math.random() - 0.5) * 10,
    ox: 0,
    oy: 0,
    ph: Math.random() * Math.PI * 2,
  }));

  let w = window.innerWidth;
  let h = window.innerHeight;
  window.addEventListener('resize', () => {
    w = window.innerWidth;
    h = window.innerHeight;
  });

  const mouse = { x: -9999, y: -9999 };
  if (fine && !reduce) {
    window.addEventListener(
      'pointermove',
      (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        // El degradado de los títulos sigue al cursor (0 → 1).
        document.documentElement.style.setProperty(
          '--gx',
          (e.clientX / window.innerWidth).toFixed(3)
        );
      },
      { passive: true }
    );
    document.documentElement.addEventListener('pointerleave', () => {
      mouse.x = -9999;
      mouse.y = -9999;
    });
  }

  const colocar = () => {
    for (const o of piezas) {
      o.el.style.transform =
        `translate3d(${(o.fx * w).toFixed(1)}px,` +
        ` ${(o.fy * h).toFixed(1)}px, 0)`;
    }
  };

  if (reduce) {
    colocar();
    return;
  }

  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const t = now / 1000;
    const mx = MARGEN / w;
    const my = MARGEN / h;
    for (const o of piezas) {
      // Deriva con reaparición por el borde opuesto.
      o.fx += (o.vx * dt) / w;
      o.fy += (o.vy * dt) / h;
      if (o.fx < -mx) o.fx += 1 + 2 * mx;
      if (o.fx > 1 + mx) o.fx -= 1 + 2 * mx;
      if (o.fy < -my) o.fy += 1 + 2 * my;
      if (o.fy > 1 + my) o.fy -= 1 + 2 * my;

      const x = o.fx * w;
      const y = o.fy * h;

      // Repulsión suave al pasar el cursor (retorno elástico).
      let px = 0;
      let py = 0;
      const dx = x - mouse.x;
      const dy = y - mouse.y;
      const d = Math.hypot(dx, dy);
      if (d < RADIO && d > 0.001) {
        const k = ((RADIO - d) / RADIO) * EMPUJE_MAX;
        px = (dx / d) * k;
        py = (dy / d) * k;
      }
      const e = Math.min(1, dt * 5);
      o.ox += (px - o.ox) * e;
      o.oy += (py - o.oy) * e;

      const bob = Math.sin(t * 0.9 + o.ph) * 8;
      const rot = Math.sin(t * 0.5 + o.ph) * 7;
      o.el.style.transform =
        `translate3d(${(x + o.ox).toFixed(1)}px,` +
        ` ${(y + o.oy + bob).toFixed(1)}px, 0)` +
        ` rotate(${rot.toFixed(2)}deg)`;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
