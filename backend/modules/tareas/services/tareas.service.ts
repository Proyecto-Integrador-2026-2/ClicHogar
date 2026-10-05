import {
  NotFoundError,
  ValidationError,
} from '../../../shared/errors/app-error';
import { usuariosRepository } from '../../usuarios/repositories/usuarios.repository';
import {
  CATEGORIAS,
  ESTADO_INICIAL_TAREA,
  type Categoria,
} from '../categorias';
import { toTareaPublica, type TareaPublica } from '../mappers/tarea.mapper';
import { tareasRepository } from '../repositories/tareas.repository';

export type DatosTareaCrudos = {
  titulo?: unknown;
  descripcion?: unknown;
  categoria?: unknown;
  ubicacion?: unknown;
  latitud?: unknown;
  longitud?: unknown;
};

export type DatosTareaNormalizados = {
  titulo: string;
  descripcion: string;
  categoria: Categoria;
  ubicacion: string;
  latitud: number | null;
  longitud: number | null;
};

function texto(
  valor: unknown,
  campo: string,
  min: number,
  max: number,
  mensajeCorto: string
): string {
  if (typeof valor !== 'string' || valor.trim().length < min) {
    throw new ValidationError(mensajeCorto);
  }
  const limpio = valor.trim();
  if (limpio.length > max) {
    throw new ValidationError(
      `El campo ${campo} no puede superar ${max} caracteres.`
    );
  }
  return limpio;
}

function coordenada(
  valor: unknown,
  campo: string,
  min: number,
  max: number
): number | null {
  if (valor === undefined || valor === null || valor === '') return null;
  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(numero) || numero < min || numero > max) {
    throw new ValidationError(`La coordenada ${campo} no es válida.`);
  }
  return numero;
}

/**
 * Normaliza y valida una solicitud de tarea (US-006, Esc 3-5 y #117).
 * Pura y unit-testeable: título no vacío (≤120), descripción 20-1000,
 * categoría del vocabulario, ubicación no vacía (≤200) y coordenadas
 * opcionales en rango. El `usuarioId` y el `estado` NO se aceptan aquí:
 * los fija `crearTarea`.
 */
export function normalizarTarea(
  entrada: DatosTareaCrudos
): DatosTareaNormalizados {
  const titulo = texto(
    entrada.titulo,
    'título',
    1,
    120,
    'El título es obligatorio.'
  );
  const descripcion = texto(
    entrada.descripcion,
    'descripción',
    20,
    1000,
    'Por favor, proporciona más detalles (mínimo 20 caracteres)...'
  );
  if (
    typeof entrada.categoria !== 'string' ||
    !CATEGORIAS.includes(entrada.categoria as Categoria)
  ) {
    throw new ValidationError('La categoría no es válida.');
  }
  const ubicacion = texto(
    entrada.ubicacion,
    'ubicación',
    1,
    200,
    'La ubicación es obligatoria.'
  );
  return {
    titulo,
    descripcion,
    categoria: entrada.categoria as Categoria,
    ubicacion,
    latitud: coordenada(entrada.latitud, 'latitud', -90, 90),
    longitud: coordenada(entrada.longitud, 'longitud', -180, 180),
  };
}

export const tareasService = {
  /**
   * Publica una tarea (US-006): resuelve al autor por clerkId (404 sin
   * perfil), normaliza, fija estado 'abierta' (#118) y persiste.
   */
  async crearTarea(
    clerkId: string,
    entrada: DatosTareaCrudos
  ): Promise<TareaPublica> {
    const autor = await usuariosRepository.buscarPorClerkId(clerkId);
    if (!autor) {
      throw new NotFoundError(
        'Aún no tienes perfil local. Llama a POST /api/usuarios/sync primero.'
      );
    }
    const datos = normalizarTarea(entrada);
    const tarea = await tareasRepository.crear({
      usuarioId: autor.id,
      ...datos,
      estado: ESTADO_INICIAL_TAREA,
    });
    return toTareaPublica(tarea, autor.nombre);
  },

  /**
   * Tablero de solicitudes abiertas (US-008): requiere sesión (el
   * controller ya la verificó); el rol no filtra porque el tablero es
   * el mismo para quien explore.
   */
  async listarAbiertas(): Promise<TareaPublica[]> {
    const filas = await tareasRepository.listarAbiertas();
    return filas.map(({ tarea, autorNombre }) =>
      toTareaPublica(tarea, autorNombre)
    );
  },
};
