import { sql } from '../../../db/client';

type SesionRow = {
  id: string;
  usuario_id: string;
  token: string;
  expira_en: Date;
  creado_en: Date;
};

export const sesionesRepository = {
  async crear(usuarioId: string, token: string, expiraEn: Date): Promise<void> {
    await sql`
      INSERT INTO sesiones (usuario_id, token, expira_en)
      VALUES (${usuarioId}, ${token}, ${expiraEn})
    `;
  },

  async buscarUsuarioIdPorToken(token: string): Promise<string | undefined> {
    const filas = await sql<{ usuario_id: string }[]>`
      SELECT usuario_id FROM sesiones
      WHERE token = ${token} AND expira_en > now()
      LIMIT 1
    `;
    return filas[0]?.usuario_id;
  },

  async eliminar(token: string): Promise<void> {
    await sql`DELETE FROM sesiones WHERE token = ${token}`;
  },
};