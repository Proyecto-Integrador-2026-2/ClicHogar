/**
 * Reglas y constantes de disponibilidad semanal (US-005).
 * Matriz 7 días × 3 franjas. Días estilo JS (0=domingo..6=sábado),
 * franjas en vocabulario fijo ASCII (manana/tarde/noche).
 */

export type Slot = {
  dia: number;
  franja: string;
};

/** Días para pintar la matriz (orden Lun..Dom, valores JS). */
export const DIAS = [
  { valor: 1, etiqueta: 'Lun' },
  { valor: 2, etiqueta: 'Mar' },
  { valor: 3, etiqueta: 'Mié' },
  { valor: 4, etiqueta: 'Jue' },
  { valor: 5, etiqueta: 'Vie' },
  { valor: 6, etiqueta: 'Sáb' },
  { valor: 0, etiqueta: 'Dom' },
] as const;

/** Franjas para pintar la matriz (mismo vocabulario que el backend). */
export const FRANJAS = [
  { valor: 'manana', etiqueta: 'Mañana' },
  { valor: 'tarde', etiqueta: 'Tarde' },
  { valor: 'noche', etiqueta: 'Noche' },
] as const;

/** Clave estable de un slot para Sets y comparaciones. */
export function claveSlot(dia: number, franja: string): string {
  return `${dia}:${franja}`;
}

/**
 * Alterna un slot en el conjunto seleccionado (pura y unit-testeable).
 * Devuelve un Set nuevo: nunca muta el recibido.
 */
export function alternarSlot(
  seleccionados: ReadonlySet<string>,
  dia: number,
  franja: string
): Set<string> {
  const copia = new Set(seleccionados);
  const clave = claveSlot(dia, franja);
  if (copia.has(clave)) {
    copia.delete(clave);
  } else {
    copia.add(clave);
  }
  return copia;
}

/** Convierte el Set a arreglo ordenado para el PUT. */
export function slotsAArreglo(seleccionados: ReadonlySet<string>): Slot[] {
  return [...seleccionados]
    .map((clave) => {
      const [dia, franja] = clave.split(':');
      return { dia: Number(dia), franja };
    })
    .sort((a, b) => a.dia - b.dia || a.franja.localeCompare(b.franja));
}
