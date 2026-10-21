import type { UsuariosRepositorio } from '../../usuarios/ports';
import { usuariosRepository } from '../../usuarios/repositories/usuarios.repository';
import { crearExigirUsuario } from '../../usuarios/services/usuario-actual';
import { ESTADO_INICIAL_TAREA } from '../categorias';
import { toTareaPublica, type TareaPublica } from '../mappers/tarea.mapper';
import type { TareasRepositorio } from '../ports';
import { tareasRepository } from '../repositories/tareas.repository';
import {
  normalizarTarea,
  type DatosTareaCrudos,
} from '../validators/tarea.validator';

type Dependencias = {
  usuarios: Pick<UsuariosRepositorio, 'buscarPorClerkId'>;
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
      clerkId: string,
      entrada: DatosTareaCrudos
    ): Promise<TareaPublica> {
      const autor = await exigirUsuario(clerkId);
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
     * el mismo para quien explore.
     */
    async listarAbiertas(): Promise<TareaPublica[]> {
      const filas = await tareas.listarAbiertas();
      return filas.map(({ tarea, autorNombre }) =>
        toTareaPublica(tarea, autorNombre)
      );
    },
  };
}

export const tareasService = crearTareasService({
  usuarios: usuariosRepository,
  tareas: tareasRepository,
});
