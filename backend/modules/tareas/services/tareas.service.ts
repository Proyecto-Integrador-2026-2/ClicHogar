import { ValidationError } from '../../../shared/errors/app-error';
import type { UsuariosRepositorio } from '../../usuarios/ports';
import { usuariosRepository } from '../../usuarios/repositories/usuarios.repository';
import { crearExigirUsuario } from '../../usuarios/services/usuario-actual';
import { ESTADO_INICIAL_TAREA } from '../categorias';
import { toTareaPublica, type TareaPublica } from '../mappers/tarea.mapper';
import type { FiltroCercania, TareasRepositorio } from '../ports';
import { tareasRepository } from '../repositories/tareas.repository';
import {
  normalizarTarea,
  type DatosTareaCrudos,
} from '../validators/tarea.validator';

export const LIMITE_POR_DEFECTO = 12;
export const LIMITE_MAXIMO = 50;

export type ConsultaListado = {
  pagina?: number;
  limite?: number;
  lat?: number;
  lng?: number;
  radio?: number;
};

export type PaginaTareas = {
  tareas: TareaPublica[];
  pagina: number;
  limite: number;
  hayMas: boolean;
};

function enteroPositivo(valor: number | undefined, defecto: number): number {
  if (valor === undefined) return defecto;
  if (!Number.isInteger(valor) || valor < 1) {
    throw new ValidationError('Paginación inválida.');
  }
  return valor;
}

/** Filtro de cercanía: o llegan lat, lng y radio juntos, o ninguno. */
function normalizarCercania(
  consulta: ConsultaListado
): FiltroCercania | undefined {
  const { lat, lng, radio } = consulta;
  const dadas = [lat, lng, radio].filter((v) => v !== undefined).length;
  if (dadas === 0) return undefined;
  if (
    lat === undefined ||
    lng === undefined ||
    radio === undefined ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    !Number.isFinite(radio)
  ) {
    throw new ValidationError(
      'El filtro de cercanía necesita lat, lng y radio.'
    );
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || radio <= 0) {
    throw new ValidationError('El filtro de cercanía está fuera de rango.');
  }
  return { lat, lng, radio };
}

type Dependencias = {
  usuarios: Pick<UsuariosRepositorio, 'buscarPorId'>;
  tareas: TareasRepositorio;
};

/** Construye el service con los repositorios recibidos (inyección). */
export function crearTareasService({ usuarios, tareas }: Dependencias) {
  const exigirUsuario = crearExigirUsuario(usuarios);

  return {
    /**
     * Publica una tarea (US-006): resuelve al autor (404 sin perfil),
     * normaliza, fija estado 'abierta' (#118) y persiste.
     */
    async crearTarea(
      usuarioId: string,
      entrada: DatosTareaCrudos
    ): Promise<TareaPublica> {
      const autor = await exigirUsuario(usuarioId);
      const datos = normalizarTarea(entrada);
      const tarea = await tareas.crear({
        usuarioId: autor.id,
        ...datos,
        estado: ESTADO_INICIAL_TAREA,
      });
      return toTareaPublica(tarea, autor.nombre);
    },

    /**
     * Tablero de solicitudes abiertas (US-008): requiere sesión (el
     * controller ya la verificó). Devuelve una página de `limite` tareas,
     * recientes primero; pide una fila de más para saber si hay otra
     * página (`hayMas`) sin un COUNT.
     */
    async listarAbiertas(
      consulta: ConsultaListado = {}
    ): Promise<PaginaTareas> {
      const pagina = enteroPositivo(consulta.pagina, 1);
      const limite = Math.min(
        enteroPositivo(consulta.limite, LIMITE_POR_DEFECTO),
        LIMITE_MAXIMO
      );
      const filas = await tareas.listarAbiertas({
        limite: limite + 1,
        desplazamiento: (pagina - 1) * limite,
        cerca: normalizarCercania(consulta),
      });
      return {
        tareas: filas
          .slice(0, limite)
          .map(({ tarea, autorNombre }) => toTareaPublica(tarea, autorNombre)),
        pagina,
        limite,
        hayMas: filas.length > limite,
      };
    },
  };
}

export const tareasService = crearTareasService({
  usuarios: usuariosRepository,
  tareas: tareasRepository,
});
