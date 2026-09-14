import {
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
  boolean,
} from 'drizzle-orm/pg-core';

/**
 * ⚠️ Este archivo NO se usa en runtime. Es solo la definición de tabla que
 * `drizzle-kit` lee para generar el SQL de las migraciones (ver
 * `backend/drizzle.config.ts` y `bun run db:generate`). La aplicación nunca
 * importa `drizzle-orm` para consultar datos: eso vive en
 * `modules/usuarios/repositories/usuarios.repository.ts` con SQL nativo
 * (`bun:sql`). El tipo `Usuario` que sí usa la app está definido a mano en
 * `modules/usuarios/entities/usuario.entity.ts`, y debe mantenerse en
 * sincronía con las columnas de aquí.
 */
export const rolUsuarioEnum = pgEnum('rol_usuario', ['cliente', 'afiliado']);

export const usuarios = pgTable('usuarios', {
  id: uuid('id').primaryKey().defaultRandom(),
  nombre: varchar('nombre', { length: 120 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  rol: rolUsuarioEnum('rol').notNull().default('cliente'),
  activo: boolean('activo').notNull().default(true),
  creadoEn: timestamp('creado_en', { withTimezone: true })
    .notNull()
    .defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
