import { sql } from '../../../db/client';
import type { Categoria } from '../categorias';
import type { NuevaTarea, Tarea } from '../entities/tarea.entity';

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
};
