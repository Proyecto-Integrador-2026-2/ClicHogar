import { sql } from '../../../db/client';
import type { Categoria } from '../categorias';
import type { AutorTarea, NuevaTarea, Tarea } from '../entities/tarea.entity';
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

export const tareasRepository = {
  /**
   * Detalle de una tarea (US-009) con los datos públicos de su autor, en
   * una sola consulta, y si `visitanteId` ya se postuló (US-011). Devuelve la
   * tarea sea cual sea su estado: decidir si se puede ver es regla del servicio.
   */
  async buscarPorId(
    id: string,
    visitanteId: string
  ): Promise<
    { tarea: Tarea; autor: AutorTarea; yaPostulado: boolean } | undefined
  > {
    const filas = await sql<
      (TareaRow & {
        autor_nombre: string;
        autor_descripcion: string | null;
        autor_ubicacion: string | null;
        autor_foto_url: string | null;
        ya_postulado: boolean;
      })[]
    >`
      SELECT t.id, t.usuario_id, t.titulo, t.descripcion, t.categoria, t.estado, t.ubicacion, t.latitud, t.longitud, t.creado_en, t.actualizado_en,
             u.nombre AS autor_nombre, u.descripcion AS autor_descripcion, u.ubicacion AS autor_ubicacion, u.foto_url AS autor_foto_url,
             EXISTS (SELECT 1 FROM ofertas o WHERE o.tarea_id = t.id AND o.afiliado_id = ${visitanteId}) AS ya_postulado
      FROM tareas t
      JOIN usuarios u ON u.id = t.usuario_id
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
      yaPostulado: fila.ya_postulado,
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
