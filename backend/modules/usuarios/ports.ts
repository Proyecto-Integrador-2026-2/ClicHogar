import type { NuevoUsuario, Usuario } from './entities/usuario.entity';

/**
 * Contratos que los services de `usuarios` necesitan de la capa de datos.
 * Los services dependen de estas interfaces (no de Postgres), así se pueden
 * probar con repositorios falsos y cambiar el almacenamiento sin tocarlos.
 */

export type PatchPerfil = Partial<
  Pick<Usuario, 'fotoUrl' | 'descripcion' | 'ubicacion'>
>;

export interface UsuariosRepositorio {
  buscarPorClerkId(clerkId: string): Promise<Usuario | undefined>;
  buscarPorId(id: string): Promise<Usuario | undefined>;
  crear(datos: NuevoUsuario): Promise<Usuario>;
  actualizarParcial(id: string, patch: PatchPerfil): Promise<Usuario>;
}

export type SlotDisponibilidad = {
  diaSemana: number;
  franjaHoraria: string;
};

export interface DisponibilidadRepositorio {
  listarPorUsuarioId(usuarioId: string): Promise<SlotDisponibilidad[]>;
  reemplazar(
    usuarioId: string,
    slots: SlotDisponibilidad[]
  ): Promise<SlotDisponibilidad[]>;
}
