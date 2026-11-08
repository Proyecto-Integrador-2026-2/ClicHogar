import { sql } from '../../../db/client';

/** Calificación tal como la devuelve Postgres (snake_case, contrato del API). */
export type CalificacionFila = {
  id: string;
  tarea_id: string | null;
  autor_id: string;
  destinatario_id: string;
  puntuacion: number;
  comentario: string | null;
  creado_en: Date;
};

export type NuevaCalificacion = {
  tareaId: string | null;
  autorId: string;
  destinatarioId: string;
  puntuacion: number;
  comentario: string | null;
};

/** Única capa que habla con la tabla `calificaciones`. */
export const calificacionesRepository = {
  async crear(datos: NuevaCalificacion): Promise<CalificacionFila> {
    const filas = await sql<CalificacionFila[]>`
      INSERT INTO calificaciones (tarea_id, autor_id, destinatario_id, puntuacion, comentario)
      VALUES (${datos.tareaId}, ${datos.autorId}, ${datos.destinatarioId}, ${datos.puntuacion}, ${datos.comentario})
      RETURNING id, tarea_id, autor_id, destinatario_id, puntuacion, comentario, creado_en
    `;
    const calificacion = filas[0];
    if (!calificacion) throw new Error('No se pudo guardar la calificación.');
    return calificacion;
  },

  /** Calificaciones recibidas por un usuario, la más reciente primero. */
  listarPorDestinatario(destinatarioId: string): Promise<CalificacionFila[]> {
    return sql<CalificacionFila[]>`
      SELECT id, tarea_id, autor_id, destinatario_id, puntuacion, comentario, creado_en
      FROM calificaciones
      WHERE destinatario_id = ${destinatarioId}
      ORDER BY creado_en DESC
    `;
  },
};
