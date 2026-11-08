/** Clave de `localStorage` donde se guarda el token de sesión. */
export const TOKEN_KEY = 'ch-token';

export function obtenerToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function guardarToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function borrarToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

export function estaFirmado(): boolean {
  return !!obtenerToken();
}
