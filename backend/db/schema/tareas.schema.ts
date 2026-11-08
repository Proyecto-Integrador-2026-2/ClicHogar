import {
  doublePrecision,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { usuarios } from './usuarios.schema';

/**
 * Solicitudes de tarea (US-006). El `usuarioId` sale de la sesión (nunca
 * del body) y el `estado` nace en 'abierta' (#118). `latitud`/`longitud`
 * opcionales hasta el autocompletado de mapas (#111); sin PostGIS por
 * ahora (#121: sin extensión en la BD y sin caso de uso aún).
 */
export const tareas = pgTable('tareas', {
  id: uuid('id').primaryKey().defaultRandom(),
  usuarioId: uuid('usuario_id')
    .notNull()
    .references(() => usuarios.id, { onDelete: 'cascade' }),
  titulo: varchar('titulo', { length: 120 }).notNull(),
  descripcion: text('descripcion').notNull(),
  categoria: varchar('categoria', { length: 60 }).notNull(),
  estado: varchar('estado', { length: 20 }).notNull().default('abierta'),
  ubicacion: varchar('ubicacion', { length: 200 }).notNull(),
  latitud: doublePrecision('latitud'),
  longitud: doublePrecision('longitud'),
  /** Afiliado elegido por el creador (US-013); null mientras esté abierta. */
  afiliadoAsignadoId: uuid('afiliado_asignado_id').references(
    () => usuarios.id,
    { onDelete: 'set null' }
  ),
  /** Momento en que el creador la cerró y confirmó el pago (US-014). */
  finalizadaEn: timestamp('finalizada_en', { withTimezone: true }),
  creadoEn: timestamp('creado_en', { withTimezone: true })
    .notNull()
    .defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
