import { sql } from '../../../db/client';

/** Mensaje tal como lo devuelve Postgres (snake_case, contrato del API). */
export type MensajeFila = {
  id: string;
  remitente_id: string;
  destinatario_id: string;
  contenido: string;
  creado_en: Date;
};

/** Única capa que habla con la tabla `mensajes` (queries parametrizadas). */
export const chatRepository = {
  async crear(
    remitenteId: string,
    destinatarioId: string,
    contenido: string
  ): Promise<MensajeFila> {
    const filas = await sql<MensajeFila[]>`
      INSERT INTO mensajes (remitente_id, destinatario_id, contenido)
      VALUES (${remitenteId}, ${destinatarioId}, ${contenido})
      RETURNING id, remitente_id, destinatario_id, contenido, creado_en
    `;
    const mensaje = filas[0];
    if (!mensaje) throw new Error('No se pudo guardar el mensaje.');
    return mensaje;
  },

  /** Mensajes entre dos usuarios (en ambos sentidos), del más antiguo al más nuevo. */
  listarConversacion(
    usuarioId: string,
    otroId: string
  ): Promise<MensajeFila[]> {
    return sql<MensajeFila[]>`
      SELECT id, remitente_id, destinatario_id, contenido, creado_en
      FROM mensajes
      WHERE (remitente_id = ${usuarioId} AND destinatario_id = ${otroId})
         OR (remitente_id = ${otroId} AND destinatario_id = ${usuarioId})
      ORDER BY creado_en ASC
    `;
  },
};
