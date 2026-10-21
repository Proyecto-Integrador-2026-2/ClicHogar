/**
 * Lectura de claims de Clerk. Funciones puras: los claims varían según la
 * plantilla JWT, así que se prueban varias claves candidatas.
 */

/** Lee la primera clave no vacía (los claims varían según plantilla). */
export function getClaimString(
  claims: Record<string, unknown>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = claims[key];
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return undefined;
}

/** Lee `rol`/`role` dentro de una metadata de Clerk (unsafe/public). */
export function getMetadataRol(
  claims: Record<string, unknown>,
  metaKey: string
): string | undefined {
  const meta = claims[metaKey];
  if (typeof meta !== 'object' || meta === null) return undefined;
  for (const k of ['rol', 'role']) {
    const v = (meta as Record<string, unknown>)[k];
    if (typeof v === 'string' && v.trim() !== '') return v;
  }
  return undefined;
}
