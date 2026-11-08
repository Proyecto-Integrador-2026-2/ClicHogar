import { sql } from '../../../db/client';

export const recuperacionesRepository = {
  /** ¿Se pidió un enlace para este usuario hace menos de `segundos`? */
  async existeReciente(usuarioId: string, segundos: number): Promise<boolean> {
    const filas = await sql<{ id: string }[]>`
      SELECT id FROM recuperaciones_contrasena
      WHERE usuario_id = ${usuarioId}::uuid
        AND creado_en > now() - make_interval(secs => ${segundos})
      LIMIT 1
    `;
    return filas.length > 0;
  },

  /**
   * Guarda un enlace nuevo e invalida los anteriores sin usar del usuario
   * (solo vale el último correo recibido), en una sola sentencia.
   */
  async crear(
    usuarioId: string,
    tokenHash: string,
    expiraEn: Date
  ): Promise<void> {
    await sql`
      WITH previos AS (
        DELETE FROM recuperaciones_contrasena
        WHERE usuario_id = ${usuarioId}::uuid AND usado_en IS NULL
      )
      INSERT INTO recuperaciones_contrasena (usuario_id, token_hash, expira_en)
      VALUES (${usuarioId}::uuid, ${tokenHash}, ${expiraEn})
    `;
  },

  /**
   * Consume el enlace (un solo uso, vigente) y cambia la contraseña del
   * dueño, cerrando todas sus sesiones, de forma atómica: una sola
   * sentencia, así dos usos simultáneos del mismo enlace no pasan ambos.
   * Devuelve el id del usuario, o undefined si el enlace no sirve.
   */
  async restablecer(
    tokenHash: string,
    passwordHash: string
  ): Promise<string | undefined> {
    const filas = await sql<{ usuario_id: string }[]>`
      WITH consumido AS (
        UPDATE recuperaciones_contrasena
        SET usado_en = now()
        WHERE token_hash = ${tokenHash}
          AND usado_en IS NULL
          AND expira_en > now()
        RETURNING usuario_id
      ),
      cambio AS (
        UPDATE usuarios
        SET password_hash = ${passwordHash}, actualizado_en = now()
        WHERE id IN (SELECT usuario_id FROM consumido)
      ),
      cierre AS (
        DELETE FROM sesiones
        WHERE usuario_id IN (SELECT usuario_id FROM consumido)
      )
      SELECT usuario_id FROM consumido
    `;
    return filas[0]?.usuario_id;
  },
};
