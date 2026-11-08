import { sql } from '../../../db/client';
import type { Oferta, ResultadoOferta } from '../entities/oferta.entity';

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

/** Única capa que habla con la tabla `ofertas` (queries parametrizadas). */
export const ofertasRepository = {
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
