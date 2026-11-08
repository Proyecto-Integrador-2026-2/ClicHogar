/**
 * Redondea un promedio de estrellas a 1 decimal (4.666 -> 4.7). `null` (sin
 * calificaciones) se conserva: nunca se inventa un 0.0 (US-017).
 */
export function redondearPromedio(promedio: number | null): number | null {
  return promedio === null ? null : Math.round(promedio * 10) / 10;
}
