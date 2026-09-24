import type { Usuario } from '../entities/usuario.entity';

/**
 * Forma pública de un usuario: nunca incluye passwordHash ni otros campos
 * sensibles. Todo controller debe devolver esta forma, jamás la entidad cruda.
 */
export type UsuarioPublico = {
  id: string;
  nombre: string;
  email: string;
  rol: Usuario['rol'];
  creadoEn: Date;
};

export function toUsuarioPublico(usuario: Usuario): UsuarioPublico {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
    creadoEn: usuario.creadoEn,
  };
}
