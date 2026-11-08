import {
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { tareas } from './tareas.schema';
import { usuarios } from './usuarios.schema';

/**
 * Calificaciones de un servicio (US-016): el creador de una tarea finalizada
 * valora de 1 a 5 al afiliado que la realizó. `unique (tarea, autor)` es la
 * garantía final de que se califica una sola vez por tarea.
 */
export const calificaciones = pgTable(
  'calificaciones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tareaId: uuid('tarea_id').references(() => tareas.id, {
      onDelete: 'set null',
    }),
    autorId: uuid('autor_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    destinatarioId: uuid('destinatario_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    puntuacion: integer('puntuacion').notNull(),
    comentario: text('comentario'),
    creadoEn: timestamp('creado_en', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique('calificaciones_tarea_autor_unique').on(t.tareaId, t.autorId)]
);
