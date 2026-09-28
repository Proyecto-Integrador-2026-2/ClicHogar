/**
 * Botón de tema claro/oscuro: alterna `data-theme` en `<html>`, persiste
 * la elección en `localStorage` y anuncia el estado vía `aria-pressed` +
 * `aria-label`. El tema INICIAL lo fija el script `is:inline` del `<head>`
 * (antes del primer pintado, para evitar el flash); aquí solo el toggle.
 */

const STORAGE_KEY = 'ch-theme';

/** Sincroniza el botón con el tema activo. */
function syncThemeButton(btn: HTMLElement): void {
  const dark = document.documentElement.dataset.theme === 'dark';
  btn.setAttribute('aria-pressed', String(dark));
  btn.setAttribute(
    'aria-label',
    dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'
  );
}

/** Conecta el botón `#ch-theme-toggle`. No-op si no existe en la página. */
export function initThemeToggle(): void {
  const btn = document.getElementById('ch-theme-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const next =
      document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* sin almacenamiento: el tema vive solo en la sesión */
    }
    syncThemeButton(btn);
  });
  syncThemeButton(btn);
}
