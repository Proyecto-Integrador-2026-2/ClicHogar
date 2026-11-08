import type { AutorTarea, NuevaTarea, Tarea } from './entities/tarea.entity';

/** Filtro por cercanía: centro (grados) y radio en kilómetros. */
export type FiltroCercania = { lat: number; lng: number; radio: number };

/** Ventana de resultados del tablero (US-008, carga progresiva). */
export type OpcionesListado = {
  limite: number;
  desplazamiento: number;
  cerca?: FiltroCercania;
};

/**
 * Contrato que el service de `tareas` necesita de la capa de datos
 * (ver `modules/usuarios/ports.ts`).
 */
export interface TareasRepositorio {
  crear(datos: NuevaTarea): Promise<Tarea>;
  buscarPorId(
    id: string,
    visitanteId: string
  ): Promise<
    { tarea: Tarea; autor: AutorTarea; yaPostulado: boolean } | undefined
  >;
  listarPorAutor(
    usuarioId: string
  ): Promise<
    Array<{ tarea: Tarea; autorNombre: string; totalOfertas: number }>
  >;
  listarAbiertas(
    opciones: OpcionesListado
  ): Promise<Array<{ tarea: Tarea; autorNombre: string }>>;
}
