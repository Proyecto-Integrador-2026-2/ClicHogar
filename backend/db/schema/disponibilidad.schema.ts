import {
  pgTable,
  smallint,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { usuarios } from './usuarios.schema';

/**
 * Disponibilidad semanal de afiliados (US-005, #104).
 * Una fila por (usuario, día, franja): la matriz 7×3 del formulario.
 * `diaSemana`: 0=domingo … 6=sábado (convención JS). `franjaHoraria`:
 * vocabulario fijo en ASCII (manana/tarde/noche) para filtros futuros.
 * Sin updated_at: el reemplazo total (DELETE+INSERT) es la escritura.
 */
export const disponibilidad = pgTable(
  'disponibilidad',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    diaSemana: smallint('dia_semana').notNull(),
    franjaHoraria: varchar('franja_horaria', { length: 20 }).notNull(),
  },
  (tabla) => [
    uniqueIndex('disponibilidad_usuario_dia_franja_uniq').on(
      tabla.usuarioId,
      tabla.diaSemana,
      tabla.franjaHoraria
    ),
  ]
);
