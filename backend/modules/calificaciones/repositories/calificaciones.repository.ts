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

export type ResultadoCalificacion =
  | { tipo: 'creada'; calificacion: CalificacionFila }
  | { tipo: 'duplicada' }
  | { tipo: 'no-elegible' };

/** Única capa que habla con la tabla `calificaciones`. */
export const calificacionesRepository = {
  /**
   * Registra la calificación del creador a su afiliado (US-016) en una sola
   * sentencia: el destinatario sale de la propia tarea y solo se inserta si
   * la tarea es del autor, está finalizada y tiene afiliado asignado. El
   * `UNIQUE (tarea, autor)` evita la calificación duplicada, incluso con dos
   * envíos simultáneos.
   */
  async crearParaTarea(datos: {
    tareaId: string;
    autorId: string;
    puntuacion: number;
    comentario: string | null;
  }): Promise<ResultadoCalificacion> {
    const filas = await sql<CalificacionFila[]>`
      INSERT INTO calificaciones (tarea_id, autor_id, destinatario_id, puntuacion, comentario)
      SELECT t.id, t.usuario_id, t.afiliado_asignado_id, ${datos.puntuacion}::int, ${datos.comentario}::text
      FROM tareas t
      WHERE t.id = ${datos.tareaId}::uuid AND t.usuario_id = ${datos.autorId}::uuid
        AND t.estado = 'finalizada' AND t.afiliado_asignado_id IS NOT NULL
      ON CONFLICT (tarea_id, autor_id) DO NOTHING
      RETURNING id, tarea_id, autor_id, destinatario_id, puntuacion, comentario, creado_en
    `;
    const nueva = filas[0];
    if (nueva) return { tipo: 'creada', calificacion: nueva };
    // No se insertó: o ya había una calificación de este autor o la tarea no es elegible.
    return {
      tipo: (await this.existe(datos.tareaId, datos.autorId))
        ? 'duplicada'
        : 'no-elegible',
    };
  },

  /** ¿El autor ya calificó esta tarea? */
  async existe(tareaId: string, autorId: string): Promise<boolean> {
    const filas = await sql<{ existe: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM calificaciones WHERE tarea_id = ${tareaId}::uuid AND autor_id = ${autorId}::uuid
      ) AS existe
    `;
    return filas[0]?.existe ?? false;
  },

  /** Calificaciones recibidas por un usuario, la más reciente primero. */
  async listarPorDestinatario(
    destinatarioId: string
  ): Promise<CalificacionFila[]> {
    const filas = await sql<CalificacionFila[]>`
      SELECT id, tarea_id, autor_id, destinatario_id, puntuacion, comentario, creado_en
      FROM calificaciones
      WHERE destinatario_id = ${destinatarioId}
      ORDER BY creado_en DESC
    `;
    // Array plano: el resultado de Bun SQL es una subclase que Elysia no
    // trata como JSON y por eso la respuesta salía sin cabeceras CORS.
    return [...filas];
  },
};
