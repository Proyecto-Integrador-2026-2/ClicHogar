/**
 * Rutas que exigen sesión (US-003, tarea #129).
 * Prefijos exactos sobre el pathname (sin query): `/dashboard` y todo lo
 * que cuelgue de él, igual para `/perfil`. Ojo con falsos amigos:
 * `/perfiles` o `/dashboardx` NO están protegidas.
 */

/** Prefijos protegidos (sin slash final). */
const PROTEGIDAS = ['/dashboard', '/perfil'];

/** True si la ruta exige sesión autenticada. */
export function isProtectedRoute(pathname: string): boolean {
  const ruta = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return PROTEGIDAS.some(
    (base) => ruta === base || ruta.startsWith(`${base}/`)
  );
}
