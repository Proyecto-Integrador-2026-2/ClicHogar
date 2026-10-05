/**
 * Ranura de autenticación del menú sin React (US-003, #127-128).
 *
 * Por qué no es una isla: cada isla `client:*` es un root React aislado y
 * `@clerk/clerk-react` lanza error con más de un `<ClerkProvider>` por
 * página (el formulario ya usa el suyo). Aquí se lee el estado directo
 * de `window.Clerk` (inyectado por `@clerk/astro`), sin providers extra.
 *
 * Elementos que gobierna (atributo `data-nav-auth`):
 * - `out`: visible sin sesión (p. ej. enlace "Crear cuenta").
 * - `in`: visible con sesión (p. ej. botón `data-logout`).
 */

type ClerkGlobal = {
  loaded?: boolean;
  session?: unknown;
  signOut?: () => Promise<void>;
  addListener?: (cb: () => void) => void;
};

function clerkGlobal(): ClerkGlobal | undefined {
  return (window as unknown as { Clerk?: ClerkGlobal }).Clerk;
}

/** Muestra/oculta cada ranura según haya sesión o no. */
function sincronizarRanuras(): void {
  const haySesion = !!clerkGlobal()?.session;
  const ranuras = document.querySelectorAll<HTMLElement>('[data-nav-auth]');
  for (const el of ranuras) {
    const quiereDentro = el.dataset.navAuth === 'in';
    el.hidden = quiereDentro ? !haySesion : haySesion;
  }
}

/** Conecta los botones `data-logout`: signOut + limpieza + redirect. */
function conectarSalidas(): void {
  const botones = document.querySelectorAll<HTMLButtonElement>('[data-logout]');
  for (const btn of botones) {
    btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      btn.disabled = true;
      try {
        await clerkGlobal()?.signOut?.();
        // Limpieza local: solo claves de sesión de la app. La preferencia
        // de tema (`ch-theme`) se conserva a propósito.
        sessionStorage.clear();
        window.location.href = '/';
      } finally {
        btn.disabled = false;
      }
    });
  }
}

/**
 * Arranca la ranura. No bloquea: si ClerkJS aún no cargó, reintenta por
 * ~10s y luego se suscribe a sus cambios de sesión.
 */
export function initNavAuth(): void {
  conectarSalidas();
  sincronizarRanuras();
  let intentos = 0;
  const esperar = () => {
    const clerk = clerkGlobal();
    if (clerk?.loaded || intentos++ > 100) {
      sincronizarRanuras();
      try {
        clerk?.addListener?.(() => sincronizarRanuras());
      } catch {
        /* sin suscripción: el estado queda con el último sync */
      }
      return;
    }
    window.setTimeout(esperar, 100);
  };
  esperar();
}
