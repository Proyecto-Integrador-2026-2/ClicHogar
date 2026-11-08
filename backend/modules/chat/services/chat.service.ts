import {
  NotFoundError,
  ValidationError,
} from '../../../shared/errors/app-error';
import { usuariosRepository } from '../../usuarios/repositories/usuarios.repository';
import {
  chatRepository,
  type MensajeFila,
} from '../repositories/chat.repository';

export const chatService = {
  /** Envía un mensaje: texto no vacío, destinatario existente y distinto del autor. */
  async enviar(
    remitenteId: string,
    destinatarioId: string,
    contenido: string
  ): Promise<MensajeFila> {
    const texto = contenido.trim();
    if (!texto) throw new ValidationError('El mensaje no puede estar vacío.');
    if (destinatarioId === remitenteId) {
      throw new ValidationError('No puedes enviarte mensajes a ti mismo.');
    }
    if (!(await usuariosRepository.buscarPorId(destinatarioId))) {
      throw new NotFoundError('Usuario no encontrado.');
    }
    return chatRepository.crear(remitenteId, destinatarioId, texto);
  },

  /** Conversación entre el usuario de la sesión y otro usuario. */
  conversacion(usuarioId: string, otroId: string): Promise<MensajeFila[]> {
    return chatRepository.listarConversacion(usuarioId, otroId);
  },
};
