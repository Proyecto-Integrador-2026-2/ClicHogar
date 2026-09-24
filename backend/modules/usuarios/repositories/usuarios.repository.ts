import { sql } from '../../../db/client';
import type {
  NuevoUsuario,
  RolUsuario,
  Usuario,
} from '../entities/usuario.entity';

/**
 * Única capa que sabe hablar con la tabla `usuarios`. Los services no
 * escriben SQL directamente: siempre pasan por aquí. Todas las queries usan
 * tagged templates (`sql\`... ${valor} ...\``), que Bun parametriza de forma
 * segura — nunca se concatena texto de usuario dentro del SQL.
 */

// Fila cruda tal como la devuelve Postgres (snake_case).
type UsuarioRow = {
  id: string;
  nombre: string;
  email: string;
  password_hash: string;
  rol: RolUsuario;
  activo: boolean;
  creado_en: Date;
  actualizado_en: Date;
};

function aUsuario(fila: UsuarioRow): Usuario {
  return {
    id: fila.id,
    nombre: fila.nombre,
    email: fila.email,
    passwordHash: fila.password_hash,
    rol: fila.rol,
    activo: fila.activo,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
  };
}

export const usuariosRepository = {
  async buscarPorEmail(email: string): Promise<Usuario | undefined> {
    const filas = await sql<UsuarioRow[]>`
      SELECT id, nombre, email, password_hash, rol, activo, creado_en, actualizado_en
      FROM usuarios
      WHERE email = ${email}
      LIMIT 1
    `;
    return filas[0] ? aUsuario(filas[0]) : undefined;
  },

  async buscarPorId(id: string): Promise<Usuario | undefined> {
    const filas = await sql<UsuarioRow[]>`
      SELECT id, nombre, email, password_hash, rol, activo, creado_en, actualizado_en
      FROM usuarios
      WHERE id = ${id}
      LIMIT 1
    `;
    return filas[0] ? aUsuario(filas[0]) : undefined;
  },

  async crear(datos: NuevoUsuario): Promise<Usuario> {
    const filas = await sql<UsuarioRow[]>`
      INSERT INTO usuarios (nombre, email, password_hash, rol)
      VALUES (${datos.nombre}, ${datos.email}, ${datos.passwordHash}, ${datos.rol})
      RETURNING id, nombre, email, password_hash, rol, activo, creado_en, actualizado_en
    `;
    const usuario = filas[0];
    if (!usuario) {
      throw new Error('No se pudo crear el usuario.');
    }
    return aUsuario(usuario);
  },
};
