import {
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { tareas } from './tareas.schema';
import { usuarios } from './usuarios.schema';

/**
 * Ofertas (postulaciones) de afiliados a una tarea (US-011). Un afiliado
 * solo puede postularse una vez a cada tarea (`unique`): el constraint es la
 * garantía final ante doble clic o peticiones concurrentes.
 */
export const ofertas = pgTable(
  'ofertas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tareaId: uuid('tarea_id')
      .notNull()
      .references(() => tareas.id, { onDelete: 'cascade' }),
    afiliadoId: uuid('afiliado_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    /** Propuesta de valor opcional que lee el creador al evaluar. */
    mensaje: text('mensaje'),
    estado: varchar('estado', { length: 20 }).notNull().default('pendiente'),
    creadoEn: timestamp('creado_en', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique('ofertas_tarea_afiliado_unique').on(t.tareaId, t.afiliadoId)]
);
