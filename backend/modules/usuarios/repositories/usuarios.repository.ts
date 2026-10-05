import { sql } from '../../../db/client';
import { NotFoundError } from '../../../shared/errors/app-error';
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
  clerk_id: string | null;
  nombre: string;
  email: string;
  password_hash: string | null;
  rol: RolUsuario;
  foto_url: string | null;
  descripcion: string | null;
  ubicacion: string | null;
  activo: boolean;
  creado_en: Date;
  actualizado_en: Date;
};

function aUsuario(fila: UsuarioRow): Usuario {
  return {
    id: fila.id,
    clerkId: fila.clerk_id,
    nombre: fila.nombre,
    email: fila.email,
    passwordHash: fila.password_hash,
    rol: fila.rol,
    fotoUrl: fila.foto_url,
    descripcion: fila.descripcion,
    ubicacion: fila.ubicacion,
    activo: fila.activo,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
  };
}

export const usuariosRepository = {
  async buscarPorEmail(email: string): Promise<Usuario | undefined> {
    const filas = await sql<UsuarioRow[]>`
      SELECT id, clerk_id, nombre, email, password_hash, rol, foto_url, descripcion, ubicacion, activo, creado_en, actualizado_en
      FROM usuarios
      WHERE email = ${email}
      LIMIT 1
    `;
    return filas[0] ? aUsuario(filas[0]) : undefined;
  },

  async buscarPorClerkId(clerkId: string): Promise<Usuario | undefined> {
    const filas = await sql<UsuarioRow[]>`
      SELECT id, clerk_id, nombre, email, password_hash, rol, foto_url, descripcion, ubicacion, activo, creado_en, actualizado_en
      FROM usuarios
      WHERE clerk_id = ${clerkId}
      LIMIT 1
    `;
    return filas[0] ? aUsuario(filas[0]) : undefined;
  },

  async buscarPorId(id: string): Promise<Usuario | undefined> {
    const filas = await sql<UsuarioRow[]>`
      SELECT id, clerk_id, nombre, email, password_hash, rol, foto_url, descripcion, ubicacion, activo, creado_en, actualizado_en
      FROM usuarios
      WHERE id = ${id}
      LIMIT 1
    `;
    return filas[0] ? aUsuario(filas[0]) : undefined;
  },

  async crear(datos: NuevoUsuario): Promise<Usuario> {
    const filas = await sql<UsuarioRow[]>`
      INSERT INTO usuarios (clerk_id, nombre, email, password_hash, rol)
      VALUES (${datos.clerkId ?? null}, ${datos.nombre}, ${datos.email}, ${datos.passwordHash ?? null}, ${datos.rol})
      RETURNING id, clerk_id, nombre, email, password_hash, rol, foto_url, descripcion, ubicacion, activo, creado_en, actualizado_en
    `;
    const usuario = filas[0];
    if (!usuario) {
      throw new Error('No se pudo crear el usuario.');
    }
    return aUsuario(usuario);
  },

  /**
   * Actualización parcial (US-004, Escenario 2): solo toca las columnas
   * del patch. Los nombres salen de un mapa fijo (nunca del cliente) y
   * los valores van como parámetros, así que no hay inyección por
   * identificador ni por valor. Sin campos devuelve el usuario intacto.
   */
  async actualizarParcial(
    id: string,
    patch: Partial<Pick<Usuario, 'fotoUrl' | 'descripcion' | 'ubicacion'>>
  ): Promise<Usuario> {
    const columnas: Record<string, string | null> = {};
    if (patch.fotoUrl !== undefined) columnas['foto_url'] = patch.fotoUrl;
    if (patch.descripcion !== undefined)
      columnas['descripcion'] = patch.descripcion;
    if (patch.ubicacion !== undefined) columnas['ubicacion'] = patch.ubicacion;

    const nombres = Object.keys(columnas);
    if (nombres.length === 0) {
      const actual = await usuariosRepository.buscarPorId(id);
      if (!actual) throw new NotFoundError('Usuario no encontrado.');
      return actual;
    }

    const asignaciones = nombres
      .map((columna, i) => `"${columna}" = $${i + 1}`)
      .join(', ');
    const valores = nombres.map((c) => columnas[c]);
    const filas = await sql.unsafe<UsuarioRow[]>(
      `UPDATE usuarios SET ${asignaciones}, actualizado_en = now() WHERE id = $${nombres.length + 1} ` +
        'RETURNING id, clerk_id, nombre, email, password_hash, rol, foto_url, descripcion, ubicacion, activo, creado_en, actualizado_en',
      [...valores, id]
    );
    const usuario = filas[0];
    if (!usuario) {
      throw new NotFoundError('Usuario no encontrado.');
    }
    return aUsuario(usuario);
  },
};
