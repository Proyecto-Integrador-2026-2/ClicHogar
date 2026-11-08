/// <reference types="astro/client" />
/**
 * Ranura de autenticación de la barra de navegación: muestra u oculta los
 * elementos `[data-nav-auth="in|out"]` según haya token guardado y conecta
 * los botones `[data-logout]` con el cierre de sesión del backend.
 */
import { TOKEN_KEY } from '../lib/auth';

/** URL base del backend: `PUBLIC_API_URL`, o localhost en desarrollo. */
export function apiUrl(): string {
  return (
    import.meta.env.PUBLIC_API_URL ??
    (import.meta.env.DEV ? 'http://localhost:3000' : '')
  );
}

/** Invalida la sesión en el backend; un fallo de red no impide salir. */
async function cerrarSesionEnServidor(token: string | null): Promise<void> {
  const base = apiUrl();
  if (!base || !token) return;
  await fetch(`${base}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

export function initNavAuth(): void {
  const haySesion = !!localStorage.getItem(TOKEN_KEY);
  const ranuras = document.querySelectorAll<HTMLElement>('[data-nav-auth]');
  for (const el of ranuras) {
    const quiereDentro = el.dataset.navAuth === 'in';
    el.hidden = quiereDentro ? !haySesion : haySesion;
  }
  const botones = document.querySelectorAll<HTMLButtonElement>('[data-logout]');
  for (const btn of botones) {
    btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      btn.disabled = true;
      try {
        await cerrarSesionEnServidor(localStorage.getItem(TOKEN_KEY));
      } finally {
        localStorage.removeItem(TOKEN_KEY);
        sessionStorage.clear();
        window.location.href = '/login';
        btn.disabled = false;
      }
    });
  }
}
