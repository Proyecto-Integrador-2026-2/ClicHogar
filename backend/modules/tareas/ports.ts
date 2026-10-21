import type { NuevaTarea, Tarea } from './entities/tarea.entity';

/**
 * Contrato que el service de `tareas` necesita de la capa de datos
 * (ver `modules/usuarios/ports.ts`).
 */
export interface TareasRepositorio {
  crear(datos: NuevaTarea): Promise<Tarea>;
  listarAbiertas(): Promise<Array<{ tarea: Tarea; autorNombre: string }>>;
}
