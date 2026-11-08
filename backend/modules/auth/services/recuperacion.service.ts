import { env } from '../../../config/env';
import { correo } from '../../../shared/correo/correo';
import { ValidationError } from '../../../shared/errors/app-error';
import { usuariosRepository } from '../../usuarios/repositories/usuarios.repository';
import { recuperacionesRepository } from '../repositories/recuperaciones.repository';
import { normalizarEmail, normalizarPassword } from './auth.service';

/** Vigencia del enlace: 1 hora. */
export const ENLACE_TTL_MS = 60 * 60 * 1000;
/** Espera mínima entre dos correos para el mismo usuario. */
export const ESPERA_ENTRE_CORREOS_SEG = 60;

/** Respuesta idéntica exista o no la cuenta: no revela qué correos están registrados. */
export const MENSAJE_ENLACE_ENVIADO =
  'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.';
export const MENSAJE_ENLACE_INVALIDO =
  'El enlace no es válido o ya expiró. Solicita uno nuevo.';
export const MENSAJE_CONTRASENA_ACTUALIZADA =
  'Tu contraseña se actualizó. Ya puedes iniciar sesión.';

/** SHA-256 en hexadecimal: en la base solo vive el hash del token. */
export function hashToken(token: string): string {
  return new Bun.CryptoHasher('sha256').update(token).digest('hex');
}

export const recuperacionService = {
  /**
   * Genera un enlace de un solo uso y lo manda por correo. Siempre responde
   * lo mismo (exista o no la cuenta, falle o no el correo) para no revelar
   * qué correos están registrados.
   */
  async solicitar(args: { email?: unknown }): Promise<{ mensaje: string }> {
    const email = normalizarEmail(args.email);
    const usuario = await usuariosRepository.buscarPorEmail(email);

    if (
      usuario &&
      !(await recuperacionesRepository.existeReciente(
        usuario.id,
        ESPERA_ENTRE_CORREOS_SEG
      ))
    ) {
      const token = crypto.randomUUID() + crypto.randomUUID();
      await recuperacionesRepository.crear(
        usuario.id,
        hashToken(token),
        new Date(Date.now() + ENLACE_TTL_MS)
      );
      const enlace = `${env.FRONTEND_URL}/restablecer-contrasena?token=${token}`;
      try {
        await correo.enviar({
          para: usuario.email,
          asunto: 'Restablece tu contraseña de ClicHogar',
          texto:
            `Hola ${usuario.nombre},\n\n` +
            `Para elegir una contraseña nueva entra a este enlace (vale 1 hora y se usa una sola vez):\n${enlace}\n\n` +
            'Si no lo pediste, ignora este mensaje: tu contraseña no cambia.',
        });
      } catch (err) {
        console.error('[recuperacion] No se pudo enviar el correo:', err);
      }
    }
    return { mensaje: MENSAJE_ENLACE_ENVIADO };
  },

  /** Cambia la contraseña con un enlace vigente y cierra todas las sesiones. */
  async restablecer(args: {
    token?: unknown;
    password?: unknown;
  }): Promise<{ mensaje: string }> {
    const password = normalizarPassword(args.password);
    if (typeof args.token !== 'string' || !args.token.trim()) {
      throw new ValidationError(MENSAJE_ENLACE_INVALIDO);
    }
    const usuarioId = await recuperacionesRepository.restablecer(
      hashToken(args.token.trim()),
      await Bun.password.hash(password)
    );
    if (!usuarioId) throw new ValidationError(MENSAJE_ENLACE_INVALIDO);
    return { mensaje: MENSAJE_CONTRASENA_ACTUALIZADA };
  },
};
