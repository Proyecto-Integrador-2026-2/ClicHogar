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

/** Valoración verificada de un afiliado, con su cliente y la fecha del servicio. */
export type ValoracionFila = {
  id: string;
  puntuacion: number;
  comentario: string | null;
  creado_en: Date;
  finalizada_en: Date | null;
  cliente_nombre: string;
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

  /**
   * Resumen de reputación (US-017): promedio exacto y total de las
   * valoraciones VERIFICADAS de un afiliado. Solo cuentan las de tareas
   * formalmente asignadas a él, finalizadas y calificadas por su creador
   * (Esc 5): cualquier otra fila (sin tarea, de una tarea cancelada o
   * ajena) queda fuera. Sin valoraciones: promedio null (nunca 0).
   */
  async reputacion(
    destinatarioId: string
  ): Promise<{ promedio: number | null; total: number }> {
    const filas = await sql<{ promedio: number | null; total: number }[]>`
      SELECT AVG(c.puntuacion)::float8 AS promedio, COUNT(*)::int AS total
      FROM calificaciones c
      JOIN tareas t ON t.id = c.tarea_id
        AND t.estado = 'finalizada'
        AND t.afiliado_asignado_id = c.destinatario_id
        AND t.usuario_id = c.autor_id
      WHERE c.destinatario_id = ${destinatarioId}::uuid
    `;
    return filas[0] ?? { promedio: null, total: 0 };
  },

  /**
   * Valoraciones verificadas de un afiliado (mismas reglas que
   * `reputacion`), con el nombre del cliente y la fecha del servicio, de la
   * más reciente a la más antigua (US-017, Esc 2).
   */
  async listarVerificadas(
    destinatarioId: string,
    limite: number
  ): Promise<ValoracionFila[]> {
    const filas = await sql<ValoracionFila[]>`
      SELECT c.id, c.puntuacion, c.comentario, c.creado_en, t.finalizada_en, u.nombre AS cliente_nombre
      FROM calificaciones c
      JOIN tareas t ON t.id = c.tarea_id
        AND t.estado = 'finalizada'
        AND t.afiliado_asignado_id = c.destinatario_id
        AND t.usuario_id = c.autor_id
      JOIN usuarios u ON u.id = c.autor_id
      WHERE c.destinatario_id = ${destinatarioId}::uuid
      ORDER BY t.finalizada_en DESC NULLS LAST, c.creado_en DESC, c.id DESC
      LIMIT ${limite}
    `;
    // Array plano: el resultado de Bun SQL es una subclase que Elysia no
    // trata como JSON y por eso la respuesta salía sin cabeceras CORS.
    return [...filas];
  },
};
