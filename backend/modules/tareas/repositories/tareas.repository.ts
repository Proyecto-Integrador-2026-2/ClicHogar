import { sql } from '../../../db/client';
import type { Categoria } from '../categorias';
import type {
  NuevaTarea,
  ResultadoAsignacion,
  ResultadoFinalizacion,
  Tarea,
  TareaEncontrada,
} from '../entities/tarea.entity';
import type { OpcionesListado, TareasRepositorio } from '../ports';

/**
 * Única capa que sabe hablar con la tabla `tareas`. Queries con tagged
 * templates parametrizadas (anti SQL injection).
 */

// Fila cruda tal como la devuelve Postgres (snake_case).
type TareaRow = {
  id: string;
  usuario_id: string;
  titulo: string;
  descripcion: string;
  categoria: Categoria;
  estado: string;
  ubicacion: string;
  latitud: number | null;
  longitud: number | null;
  creado_en: Date;
  actualizado_en: Date;
};

function aTarea(fila: TareaRow): Tarea {
  return {
    id: fila.id,
    usuarioId: fila.usuario_id,
    titulo: fila.titulo,
    descripcion: fila.descripcion,
    categoria: fila.categoria,
    estado: fila.estado,
    ubicacion: fila.ubicacion,
    latitud: fila.latitud,
    longitud: fila.longitud,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
  };
}

/** Aborta la transacción de asignación cuando la oferta no es válida. */
class OfertaInvalida extends Error {}

export const tareasRepository = {
  /**
   * Detalle de una tarea (US-009) con los datos públicos de su autor, en
   * una sola consulta, y si `visitanteId` ya se postuló (US-011). Devuelve la
   * tarea sea cual sea su estado: decidir si se puede ver es regla del servicio.
   */
  async buscarPorId(
    id: string,
    visitanteId: string
  ): Promise<TareaEncontrada | undefined> {
    const filas = await sql<
      (TareaRow & {
        autor_nombre: string;
        autor_email: string;
        autor_descripcion: string | null;
        autor_ubicacion: string | null;
        autor_foto_url: string | null;
        ya_postulado: boolean;
        asignado_id: string | null;
        asignado_nombre: string | null;
        asignado_email: string | null;
      })[]
    >`
      SELECT t.id, t.usuario_id, t.titulo, t.descripcion, t.categoria, t.estado, t.ubicacion, t.latitud, t.longitud, t.creado_en, t.actualizado_en,
             u.nombre AS autor_nombre, u.email AS autor_email, u.descripcion AS autor_descripcion, u.ubicacion AS autor_ubicacion, u.foto_url AS autor_foto_url,
             EXISTS (SELECT 1 FROM ofertas o WHERE o.tarea_id = t.id AND o.afiliado_id = ${visitanteId}) AS ya_postulado,
             a.id AS asignado_id, a.nombre AS asignado_nombre, a.email AS asignado_email
      FROM tareas t
      JOIN usuarios u ON u.id = t.usuario_id
      LEFT JOIN usuarios a ON a.id = t.afiliado_asignado_id
      WHERE t.id = ${id}
      LIMIT 1
    `;
    const fila = filas[0];
    if (!fila) return undefined;
    return {
      tarea: aTarea(fila),
      autor: {
        id: fila.usuario_id,
        nombre: fila.autor_nombre,
        descripcion: fila.autor_descripcion,
        ubicacion: fila.autor_ubicacion,
        fotoUrl: fila.autor_foto_url,
      },
      autorEmail: fila.autor_email,
      yaPostulado: fila.ya_postulado,
      asignado:
        fila.asignado_id && fila.asignado_nombre && fila.asignado_email
          ? {
              id: fila.asignado_id,
              nombre: fila.asignado_nombre,
              email: fila.asignado_email,
            }
          : null,
    };
  },

  /**
   * Asigna la tarea al afiliado de una oferta (US-013) en UNA transacción:
   * 1) pasa la tarea de 'abierta' a 'asignada' (el UPDATE bloquea la fila,
   *    así que una oferta nueva o una segunda asignación simultánea esperan
   *    y ven el estado final: Esc 5);
   * 2) acepta la oferta elegida (debe ser de esa tarea y seguir pendiente);
   * 3) vincula al afiliado y rechaza el resto de ofertas pendientes (Esc 3).
   * Si la oferta no es válida se revierte todo.
   */
  async asignar(datos: {
    tareaId: string;
    autorId: string;
    ofertaId: string;
  }): Promise<ResultadoAsignacion> {
    try {
      return await sql.begin(async (tx) => {
        const tarea = await tx`
          UPDATE tareas SET estado = 'asignada', actualizado_en = now()
          WHERE id = ${datos.tareaId}::uuid AND usuario_id = ${datos.autorId}::uuid AND estado = 'abierta'
          RETURNING id
        `;
        if (!tarea[0]) return { tipo: 'no-abierta' as const };

        const oferta = await tx`
          UPDATE ofertas SET estado = 'aceptada'
          WHERE id = ${datos.ofertaId}::uuid AND tarea_id = ${datos.tareaId}::uuid AND estado = 'pendiente'
          RETURNING afiliado_id
        `;
        const afiliadoId = (oferta[0] as { afiliado_id: string } | undefined)
          ?.afiliado_id;
        if (!afiliadoId) throw new OfertaInvalida();

        await tx`
          UPDATE tareas SET afiliado_asignado_id = ${afiliadoId}::uuid
          WHERE id = ${datos.tareaId}::uuid
        `;
        await tx`
          UPDATE ofertas SET estado = 'rechazada'
          WHERE tarea_id = ${datos.tareaId}::uuid AND id <> ${datos.ofertaId}::uuid AND estado = 'pendiente'
        `;
        return { tipo: 'asignada' as const, afiliadoId };
      });
    } catch (error) {
      if (error instanceof OfertaInvalida) {
        return { tipo: 'oferta-invalida' };
      }
      throw error;
    }
  },

  /**
   * Cierra la tarea (US-014): 'asignada' -> 'finalizada' solo para su
   * creador y con una sola sentencia atómica, así un doble clic o dos
   * sesiones simultáneas la finalizan una única vez.
   */
  async finalizar(datos: {
    tareaId: string;
    autorId: string;
  }): Promise<ResultadoFinalizacion> {
    const filas = await sql<
      { afiliado_asignado_id: string; finalizada_en: Date }[]
    >`
      UPDATE tareas SET estado = 'finalizada', finalizada_en = now(), actualizado_en = now()
      WHERE id = ${datos.tareaId}::uuid AND usuario_id = ${datos.autorId}::uuid AND estado = 'asignada'
      RETURNING afiliado_asignado_id, finalizada_en
    `;
    const fila = filas[0];
    if (!fila) return { tipo: 'no-asignada' };
    return {
      tipo: 'finalizada',
      afiliadoId: fila.afiliado_asignado_id,
      finalizadaEn: fila.finalizada_en,
    };
  },

  async crear(datos: NuevaTarea): Promise<Tarea> {
    const filas = await sql<TareaRow[]>`
      INSERT INTO tareas (usuario_id, titulo, descripcion, categoria, estado, ubicacion, latitud, longitud)
      VALUES (${datos.usuarioId}, ${datos.titulo}, ${datos.descripcion}, ${datos.categoria}, ${datos.estado}, ${datos.ubicacion}, ${datos.latitud}, ${datos.longitud})
      RETURNING id, usuario_id, titulo, descripcion, categoria, estado, ubicacion, latitud, longitud, creado_en, actualizado_en
    `;
    const tarea = filas[0];
    if (!tarea) {
      throw new Error('No se pudo crear la tarea.');
    }
    return aTarea(tarea);
  },

  /**
   * "Mis solicitudes" (US-012): las tareas de un usuario, la más reciente
   * primero, con cuántas ofertas lleva cada una. Tope de 100.
   */
  async listarPorAutor(
    usuarioId: string
  ): Promise<
    Array<{ tarea: Tarea; autorNombre: string; totalOfertas: number }>
  > {
    const filas = await sql<
      (TareaRow & { autor_nombre: string; total_ofertas: number })[]
    >`
      SELECT t.id, t.usuario_id, t.titulo, t.descripcion, t.categoria, t.estado, t.ubicacion, t.latitud, t.longitud, t.creado_en, t.actualizado_en,
             u.nombre AS autor_nombre,
             (SELECT COUNT(*)::int FROM ofertas o WHERE o.tarea_id = t.id) AS total_ofertas
      FROM tareas t
      JOIN usuarios u ON u.id = t.usuario_id
      WHERE t.usuario_id = ${usuarioId}
      ORDER BY t.creado_en DESC, t.id DESC
      LIMIT 100
    `;
    return filas.map((fila) => ({
      tarea: aTarea(fila),
      autorNombre: fila.autor_nombre,
      totalOfertas: fila.total_ofertas,
    }));
  },

  /**
   * Tablero de afiliados (US-008): solo solicitudes `abierta` (las
   * asignadas o finalizadas quedan fuera), recientes primero, con el
   * nombre del autor. Paginado por `limite`/`desplazamiento`; el
   * desempate por id mantiene el orden estable entre páginas. Con
   * `cerca` filtra en SQL por distancia (Haversine, km) y descarta las
   * tareas sin coordenadas.
   */
  async listarAbiertas({
    limite,
    desplazamiento,
    cerca,
  }: OpcionesListado): Promise<Array<{ tarea: Tarea; autorNombre: string }>> {
    const lat = cerca?.lat ?? null;
    const lng = cerca?.lng ?? null;
    const radio = cerca?.radio ?? null;
    const filas = await sql<(TareaRow & { autor_nombre: string })[]>`
      SELECT t.id, t.usuario_id, t.titulo, t.descripcion, t.categoria, t.estado, t.ubicacion, t.latitud, t.longitud, t.creado_en, t.actualizado_en, u.nombre AS autor_nombre
      FROM tareas t
      JOIN usuarios u ON u.id = t.usuario_id
      WHERE t.estado = 'abierta'
        AND (
          ${radio}::float8 IS NULL
          OR (
            t.latitud IS NOT NULL
            AND t.longitud IS NOT NULL
            AND 6371 * 2 * asin(sqrt(least(1,
                power(sin(radians(t.latitud - ${lat}::float8) / 2), 2)
                + cos(radians(${lat}::float8)) * cos(radians(t.latitud))
                * power(sin(radians(t.longitud - ${lng}::float8) / 2), 2)
              ))) <= ${radio}::float8
          )
        )
      ORDER BY t.creado_en DESC, t.id DESC
      LIMIT ${limite} OFFSET ${desplazamiento}
    `;
    return filas.map((fila) => ({
      tarea: aTarea(fila),
      autorNombre: fila.autor_nombre,
    }));
  },
} satisfies TareasRepositorio;
