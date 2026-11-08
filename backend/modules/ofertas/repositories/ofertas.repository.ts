import { sql } from '../../../db/client';
import type {
  Oferta,
  OfertaRecibida,
  ResultadoOferta,
} from '../entities/oferta.entity';

type OfertaRow = {
  id: string;
  tarea_id: string;
  afiliado_id: string;
  mensaje: string | null;
  estado: string;
  creado_en: Date;
};

function aOferta(fila: OfertaRow): Oferta {
  return {
    id: fila.id,
    tareaId: fila.tarea_id,
    afiliadoId: fila.afiliado_id,
    mensaje: fila.mensaje,
    estado: fila.estado,
    creadoEn: fila.creado_en,
  };
}

type OfertaRecibidaRow = OfertaRow & {
  afiliado_nombre: string;
  afiliado_foto_url: string | null;
  afiliado_descripcion: string | null;
  afiliado_ubicacion: string | null;
  promedio: number | null;
  total_calificaciones: number;
};

/** Única capa que habla con la tabla `ofertas` (queries parametrizadas). */
export const ofertasRepository = {
  /**
   * Ofertas de una tarea con el afiliado y su reputación (US-012), en una
   * sola consulta. Orden: mejor promedio primero (los sin calificaciones al
   * final), luego la oferta más reciente; el id desempata de forma estable.
   */
  async listarPorTarea(tareaId: string): Promise<OfertaRecibida[]> {
    const filas = await sql<OfertaRecibidaRow[]>`
      SELECT o.id, o.tarea_id, o.afiliado_id, o.mensaje, o.estado, o.creado_en,
             u.nombre AS afiliado_nombre, u.foto_url AS afiliado_foto_url,
             u.descripcion AS afiliado_descripcion, u.ubicacion AS afiliado_ubicacion,
             c.promedio, COALESCE(c.total, 0)::int AS total_calificaciones
      FROM ofertas o
      JOIN usuarios u ON u.id = o.afiliado_id
      LEFT JOIN (
        SELECT destinatario_id, AVG(puntuacion)::float8 AS promedio, COUNT(*)::int AS total
        FROM calificaciones
        GROUP BY destinatario_id
      ) c ON c.destinatario_id = o.afiliado_id
      WHERE o.tarea_id = ${tareaId}::uuid
      ORDER BY c.promedio DESC NULLS LAST, o.creado_en DESC, o.id DESC
    `;
    return filas.map((fila) => ({
      id: fila.id,
      mensaje: fila.mensaje,
      estado: fila.estado,
      creadoEn: fila.creado_en,
      afiliado: {
        id: fila.afiliado_id,
        nombre: fila.afiliado_nombre,
        fotoUrl: fila.afiliado_foto_url,
        descripcion: fila.afiliado_descripcion,
        ubicacion: fila.afiliado_ubicacion,
        promedio: fila.promedio,
        totalCalificaciones: fila.total_calificaciones,
      },
    }));
  },

  /**
   * Registra la oferta SOLO si la tarea sigue abierta y el afiliado no se
   * había postulado, en una sola sentencia (US-011, Esc 3 y 5). `FOR SHARE`
   * bloquea la fila de la tarea mientras se inserta: si el creador la asigna
   * o cancela al mismo tiempo, una de las dos operaciones espera a la otra,
   * así que nunca queda una oferta nueva sobre una tarea ya cerrada. El
   * `UNIQUE (tarea_id, afiliado_id)` frena el doble clic concurrente.
   */
  async crear(datos: {
    tareaId: string;
    afiliadoId: string;
    mensaje: string | null;
  }): Promise<ResultadoOferta> {
    const filas = await sql<OfertaRow[]>`
      INSERT INTO ofertas (tarea_id, afiliado_id, mensaje)
      SELECT ${datos.tareaId}::uuid, ${datos.afiliadoId}::uuid, ${datos.mensaje}::text
      WHERE EXISTS (
        SELECT 1 FROM tareas WHERE id = ${datos.tareaId}::uuid AND estado = 'abierta' FOR SHARE
      )
      ON CONFLICT (tarea_id, afiliado_id) DO NOTHING
      RETURNING id, tarea_id, afiliado_id, mensaje, estado, creado_en
    `;
    const nueva = filas[0];
    if (nueva) return { tipo: 'creada', oferta: aOferta(nueva) };

    // No se insertó: o ya había una oferta de este afiliado o la tarea se cerró.
    const previas = await sql<{ existe: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM ofertas WHERE tarea_id = ${datos.tareaId}::uuid AND afiliado_id = ${datos.afiliadoId}::uuid
      ) AS existe
    `;
    return { tipo: previas[0]?.existe ? 'duplicada' : 'no-abierta' };
  },
};
