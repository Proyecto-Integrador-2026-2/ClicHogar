/**
 * Forma de la fila `usuarios` tal como la usa la app (camelCase). Definida
 * a mano porque no usamos ORM; debe mantenerse en sincronía con las
 * columnas reales de la tabla (ver `backend/db/schema/usuarios.schema.ts`,
 * que es solo la definición usada por drizzle-kit para generar el SQL de
 * las migraciones, no algo que la app importe).
 */
export type RolUsuario = 'cliente' | 'afiliado';

export type Usuario = {
  id: string;
  clerkId: string | null;
  nombre: string;
  email: string;
  passwordHash: string | null;
  rol: RolUsuario;
  activo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
};

/** Campos necesarios para insertar un usuario nuevo. */
export type NuevoUsuario = {
  clerkId?: string | null;
  nombre: string;
  email: string;
  passwordHash?: string | null;
  rol: RolUsuario;
};
