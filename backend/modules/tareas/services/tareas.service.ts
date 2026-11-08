import type { UsuariosRepositorio } from '../../usuarios/ports';
import { usuariosRepository } from '../../usuarios/repositories/usuarios.repository';
import { crearExigirUsuario } from '../../usuarios/services/usuario-actual';
import { ESTADO_INICIAL_TAREA } from '../categorias';

function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
import { toTareaPublica, type TareaPublica } from '../mappers/tarea.mapper';
import type { TareasRepositorio } from '../ports';
import { tareasRepository } from '../repositories/tareas.repository';
import {
  normalizarTarea,
  type DatosTareaCrudos,
} from '../validators/tarea.validator';

type Dependencias = {
  usuarios: Pick<UsuariosRepositorio, 'buscarPorId'>;
  tareas: TareasRepositorio;
};

/** Construye el service con los repositorios recibidos (inyección). */
export function crearTareasService({ usuarios, tareas }: Dependencias) {
  const exigirUsuario = crearExigirUsuario(usuarios);

  return {
    /**
     * Publica una tarea (US-006): resuelve al autor por clerkId (404 sin
     * perfil), normaliza, fija estado 'abierta' (#118) y persiste.
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
     * controller ya la verificó); el rol no filtra porque el tablero es
     * el mismo para quien explore. Filtra por proximidad si se reciben
     * coordenadas y radio (km).
     */
    async listarAbiertas(filtros?: {
      lat?: number;
      lng?: number;
      radio?: number;
    }): Promise<TareaPublica[]> {
      const filas = await tareas.listarAbiertas();
      let resultado = filas.map(({ tarea, autorNombre }) =>
        toTareaPublica(tarea, autorNombre)
      );
      if (
        filtros?.lat != null &&
        filtros?.lng != null &&
        filtros?.radio != null
      ) {
        const radio = filtros.radio;
        resultado = resultado
          .filter((t) => {
            if (t.latitud == null || t.longitud == null) return false;
            const d = distanciaKm(filtros.lat!, filtros.lng!, t.latitud, t.longitud);
            return d <= radio;
          })
          .map((t) => t);
      }
      return resultado;
    },
  };
}

export const tareasService = crearTareasService({
  usuarios: usuariosRepository,
  tareas: tareasRepository,
});
