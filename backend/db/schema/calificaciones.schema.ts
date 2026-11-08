import { pgTable, timestamp, uuid, varchar, integer, text } from 'drizzle-orm/pg-core';
import { usuarios } from './usuarios.schema';
import { tareas } from './tareas.schema';

export const calificaciones = pgTable('calificaciones', {
  id: uuid('id').primaryKey().defaultRandom(),
  tareaId: uuid('tarea_id').references(() => tareas.id, { onDelete: 'set null' }),
  autorId: uuid('autor_id').notNull().references(() => usuarios.id, { onDelete: 'cascade' }),
  destinatarioId: uuid('destinatario_id').notNull().references(() => usuarios.id, { onDelete: 'cascade' }),
  puntuacion: integer('puntuacion').notNull(),
  comentario: text('comentario'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});