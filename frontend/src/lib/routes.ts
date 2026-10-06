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
  // Sin regex: recorte lineal de `/` finales (`/` sola se conserva).
  let ruta = pathname;
  while (ruta.length > 1 && ruta.endsWith('/')) {
    ruta = ruta.slice(0, -1);
  }
  if (EXACTAS_PROTEGIDAS.includes(ruta)) return true;
  return PROTEGIDAS.some(
    (base) => ruta === base || ruta.startsWith(`${base}/`)
  );
}
