import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { usuarios } from './usuarios.schema';

/**
 * Enlaces de recuperación de contraseña. Solo se guarda el hash (SHA-256)
 * del token: quien lea la base no puede usar los enlaces pendientes.
 */
export const recuperacionesContrasena = pgTable('recuperaciones_contrasena', {
  id: uuid('id').primaryKey().defaultRandom(),
  usuarioId: uuid('usuario_id')
    .notNull()
    .references(() => usuarios.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  expiraEn: timestamp('expira_en', { withTimezone: true }).notNull(),
  usadoEn: timestamp('usado_en', { withTimezone: true }),
  creadoEn: timestamp('creado_en', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
