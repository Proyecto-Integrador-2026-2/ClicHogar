import { sql } from '../../../db/client';
import type { Categoria } from '../../tareas/categorias';
import type {
  MisOfertas,
  Oferta,
  OfertaRecibida,
  ResultadoOferta,
  TareaConOfertas,
  TareaResumenOferta,
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

/** Tarea resumida compartida por los dos bloques de "Mis ofertas". */
type TareaResumenRow = {
  id: string;
  usuario_id: string;
  titulo: string;
  descripcion: string;
  categoria: Categoria;
  estado: string;
  ubicacion: string;
  creado_en: Date;
  autor_nombre: string;
};

function aTareaResumen(fila: TareaResumenRow): TareaResumenOferta {
  return {
    id: fila.id,
    titulo: fila.titulo,
    descripcion: fila.descripcion,
    categoria: fila.categoria,
    estado: fila.estado,
    ubicacion: fila.ubicacion,
    creadoEn: fila.creado_en,
    autorId: fila.usuario_id,
    autorNombre: fila.autor_nombre,
  };
}

/** Fila de una tarea propia con una oferta recibida (puede no haber). */
type TareaConOfertaRow = TareaResumenRow & {
  oferta_id: string | null;
  oferta_mensaje: string | null;
  oferta_estado: string | null;
  oferta_creado_en: Date | null;
  afiliado_id: string | null;
  afiliado_nombre: string | null;
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
        SELECT c.destinatario_id, AVG(c.puntuacion)::float8 AS promedio, COUNT(*)::int AS total
        FROM calificaciones c
        JOIN tareas t ON t.id = c.tarea_id
          AND t.estado = 'finalizada'
          AND t.afiliado_asignado_id = c.destinatario_id
          AND t.usuario_id = c.autor_id
        GROUP BY c.destinatario_id
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
   * "Tareas aceptadas" de "Mis ofertas": las tareas activas donde el usuario
   * es el afiliado elegido, con la oferta que le aceptaron. Más recientes
   * primero y tope de 100.
   */
  async listarAceptadas(usuarioId: string): Promise<MisOfertas['aceptadas']> {
    const filas = await sql<
      (TareaResumenRow & {
        oferta_id: string;
        oferta_mensaje: string | null;
        oferta_estado: string;
        oferta_creado_en: Date;
      })[]
    >`
      SELECT t.id, t.usuario_id, t.titulo, t.descripcion, t.categoria, t.estado, t.ubicacion, t.creado_en,
             u.nombre AS autor_nombre,
             o.id AS oferta_id, o.mensaje AS oferta_mensaje,
             o.estado AS oferta_estado, o.creado_en AS oferta_creado_en
      FROM tareas t
      JOIN usuarios u ON u.id = t.usuario_id
      JOIN ofertas o ON o.tarea_id = t.id
        AND o.afiliado_id = ${usuarioId}::uuid
        AND o.estado = 'aceptada'
      WHERE t.afiliado_asignado_id = ${usuarioId}::uuid
        AND t.estado = 'asignada'
      ORDER BY t.creado_en DESC, t.id DESC
      LIMIT 100
    `;
    return filas.map((fila) => ({
      tarea: aTareaResumen(fila),
      oferta: {
        id: fila.oferta_id,
        tareaId: fila.id,
        afiliadoId: usuarioId,
        mensaje: fila.oferta_mensaje,
        estado: fila.oferta_estado,
        creadoEn: fila.oferta_creado_en,
      },
    }));
  },

  /**
   * "Mis tareas publicadas" de "Mis ofertas": las tareas del usuario (tope
   * de 100) con todas sus ofertas recibidas, en una sola consulta. Cada
   * oferta trae los datos públicos del afiliado y su reputación; el orden
   * dentro de cada tarea es el mismo de US-012 (mejor promedio primero).
   */
  async listarCreadas(usuarioId: string): Promise<TareaConOfertas[]> {
    const filas = await sql<TareaConOfertaRow[]>`
      SELECT t.id, t.usuario_id, t.titulo, t.descripcion, t.categoria, t.estado, t.ubicacion, t.creado_en,
             u.nombre AS autor_nombre,
             o.id AS oferta_id, o.mensaje AS oferta_mensaje,
             o.estado AS oferta_estado, o.creado_en AS oferta_creado_en,
             a.id AS afiliado_id, a.nombre AS afiliado_nombre,
             a.foto_url AS afiliado_foto_url, a.descripcion AS afiliado_descripcion,
             a.ubicacion AS afiliado_ubicacion,
             c.promedio, COALESCE(c.total, 0)::int AS total_calificaciones
      FROM (
        SELECT * FROM tareas
        WHERE usuario_id = ${usuarioId}::uuid
        ORDER BY creado_en DESC, id DESC
        LIMIT 100
      ) t
      JOIN usuarios u ON u.id = t.usuario_id
      LEFT JOIN ofertas o ON o.tarea_id = t.id
      LEFT JOIN usuarios a ON a.id = o.afiliado_id
      LEFT JOIN (
        SELECT c.destinatario_id, AVG(c.puntuacion)::float8 AS promedio, COUNT(*)::int AS total
        FROM calificaciones c
        JOIN tareas t ON t.id = c.tarea_id
          AND t.estado = 'finalizada'
          AND t.afiliado_asignado_id = c.destinatario_id
          AND t.usuario_id = c.autor_id
        GROUP BY c.destinatario_id
      ) c ON c.destinatario_id = o.afiliado_id
      ORDER BY t.creado_en DESC, t.id DESC,
               c.promedio DESC NULLS LAST, o.creado_en DESC, o.id DESC
    `;

    const porTarea = new Map<string, TareaConOfertas>();
    for (const fila of filas) {
      let grupo = porTarea.get(fila.id);
      if (!grupo) {
        grupo = { tarea: aTareaResumen(fila), ofertas: [] };
        porTarea.set(fila.id, grupo);
      }
      if (fila.oferta_id !== null && fila.afiliado_id !== null) {
        grupo.ofertas.push({
          id: fila.oferta_id,
          mensaje: fila.oferta_mensaje,
          estado: fila.oferta_estado ?? '',
          creadoEn: fila.oferta_creado_en ?? fila.creado_en,
          afiliado: {
            id: fila.afiliado_id,
            nombre: fila.afiliado_nombre ?? '',
            fotoUrl: fila.afiliado_foto_url,
            descripcion: fila.afiliado_descripcion,
            ubicacion: fila.afiliado_ubicacion,
            promedio: fila.promedio,
            totalCalificaciones: fila.total_calificaciones,
          },
        });
      }
    }
    return [...porTarea.values()];
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
