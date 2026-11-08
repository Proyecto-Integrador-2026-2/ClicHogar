import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { usuarios } from './usuarios.schema';

export const sesiones = pgTable('sesiones', {
  id: uuid('id').primaryKey().defaultRandom(),
  usuarioId: uuid('usuario_id')
    .notNull()
    .references(() => usuarios.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 128 }).notNull().unique(),
  expiraEn: timestamp('expira_en', { withTimezone: true }).notNull(),
  creadoEn: timestamp('creado_en', { withTimezone: true })
    .notNull()
    .defaultNow(),
});