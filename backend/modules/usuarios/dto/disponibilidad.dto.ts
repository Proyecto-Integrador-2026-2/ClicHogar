import { t } from 'elysia';

/**
 * Body de disponibilidad (US-005): arreglo de {dia, franja}, possibly
 * vacío para limpiar todo (Escenarios 2 y 3). Elysia valida forma y
 * rangos ANTES del controller; el service re-valida y normaliza.
 */
export const DisponibilidadDto = t.Object({
  slots: t.Array(
    t.Object({
      dia: t.Integer({
        minimum: 0,
        maximum: 6,
        error: 'El día debe ser un entero entre 0 y 6.',
      }),
      franja: t.Union(
        [t.Literal('manana'), t.Literal('tarde'), t.Literal('noche')],
        { error: 'La franja debe ser manana, tarde o noche.' }
      ),
    }),
    { error: 'Los horarios deben ser un arreglo.' }
  ),
});

export type DisponibilidadInput = typeof DisponibilidadDto.static;
