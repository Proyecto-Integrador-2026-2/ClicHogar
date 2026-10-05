/**
 * Rutas que exigen sesión (US-003 #129, US-006).
 * Prefijos sobre el pathname (sin query): `/dashboard` y todo lo que
 * cuelgue de él, igual para `/perfil`. Ojo con falsos amigos:
 * `/perfiles` o `/dashboardx` NO están protegidas.
 */

/** Prefijos protegidos (sin slash final). */
const PROTEGIDAS = ['/dashboard', '/perfil'];

/**
 * Rutas exactas protegidas (sin slash final): páginas puntuales que no
 * abren familias enteras (la futura lista pública de tareas, por
 * ejemplo, debe seguir abierta).
 */
const EXACTAS_PROTEGIDAS = ['/tareas/nueva'];

/** True si la ruta exige sesión autenticada. */
export function isProtectedRoute(pathname: string): boolean {
  const ruta = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (EXACTAS_PROTEGIDAS.includes(ruta)) return true;
  return PROTEGIDAS.some(
    (base) => ruta === base || ruta.startsWith(`${base}/`)
  );
}
