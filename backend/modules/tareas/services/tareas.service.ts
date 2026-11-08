import {
  GoneError,
  NotFoundError,
  ValidationError,
} from '../../../shared/errors/app-error';
import type { Usuario } from '../../usuarios/entities/usuario.entity';
import type { UsuariosRepositorio } from '../../usuarios/ports';
import { usuariosRepository } from '../../usuarios/repositories/usuarios.repository';
import { crearExigirUsuario } from '../../usuarios/services/usuario-actual';
import { ESTADO_INICIAL_TAREA } from '../categorias';
import {
  toDetalleTarea,
  toTareaPropia,
  toTareaPublica,
  type DetalleTarea,
  type TareaPropia,
  type TareaPublica,
} from '../mappers/tarea.mapper';
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

    /** "Mis solicitudes" (US-012): las tareas del usuario con sus ofertas. */
    async listarPropias(usuarioId: string): Promise<TareaPropia[]> {
      const filas = await tareas.listarPorAutor(usuarioId);
      return filas.map(({ tarea, autorNombre, totalOfertas }) =>
        toTareaPropia(tarea, autorNombre, totalOfertas)
      );
    },

    /**
     * Detalle de una tarea (US-009). Solo es visible si está abierta (si
     * se asignó o cerró mientras el afiliado miraba el tablero: 410) salvo
     * para su propio autor, que siempre puede verla. Marca `esPropia`
     * (Esc 4: sin auto-postulación), `yaPostulado` y `puedeOfertar` (abierta,
     * ajena, el visitante es afiliado y aún no se postuló).
     */
    async obtenerDetalle(
      visitante: Pick<Usuario, 'id' | 'rol'>,
      id: string
    ): Promise<DetalleTarea> {
      const encontrada = await tareas.buscarPorId(id, visitante.id);
      if (!encontrada) throw new NotFoundError('Tarea no encontrada.');
      const { tarea, autor, yaPostulado } = encontrada;
      const esPropia = tarea.usuarioId === visitante.id;
      const abierta = tarea.estado === ESTADO_INICIAL_TAREA;
      if (!abierta && !esPropia) {
        throw new GoneError('Esta tarea ya no se encuentra disponible.');
      }
      return toDetalleTarea(tarea, autor, {
        esPropia,
        yaPostulado,
        puedeOfertar:
          abierta && !esPropia && !yaPostulado && visitante.rol === 'afiliado',
      });
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
