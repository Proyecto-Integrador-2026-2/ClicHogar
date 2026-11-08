import { pgTable, timestamp, uuid, text } from 'drizzle-orm/pg-core';
import { usuarios } from './usuarios.schema';

export const mensajes = pgTable('mensajes', {
  id: uuid('id').primaryKey().defaultRandom(),
  remitenteId: uuid('remitente_id')
    .notNull()
    .references(() => usuarios.id, { onDelete: 'cascade' }),
  destinatarioId: uuid('destinatario_id')
    .notNull()
    .references(() => usuarios.id, { onDelete: 'cascade' }),
  contenido: text('contenido').notNull(),
  creadoEn: timestamp('creado_en', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
