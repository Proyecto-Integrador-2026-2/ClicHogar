/**
 * Validación de los formularios de recuperación de contraseña. Reutiliza las
 * reglas del login (correo) y del registro (contraseña nueva) para que los
 * mensajes sean los mismos en toda la aplicación.
 */
import { validarCampoLogin } from './login.validation';
import { validarCampo } from './register.validation';

export const IDS_RECUPERACION = {
  email: 'ch-recuperar-email',
  password: 'ch-nueva-password',
  confirmPassword: 'ch-nueva-confirm',
} as const;

/** Error del correo (o undefined si es válido). */
export function validarCorreoRecuperacion(email: string): string | undefined {
  return validarCampoLogin('email', { email, password: '' });
}

/** Errores de la contraseña nueva y su confirmación. */
export function validarContrasenaNueva(
  password: string,
  confirmPassword: string
): { password?: string; confirmPassword?: string } {
  const valores = {
    name: '',
    email: '',
    password,
    confirmPassword,
    role: '' as const,
    termsAccepted: false,
  };
  const errores: { password?: string; confirmPassword?: string } = {};
  const clave = validarCampo('password', valores);
  if (clave) errores.password = clave;
  if (!confirmPassword) {
    errores.confirmPassword = 'Este campo es obligatorio';
  } else {
    const coincide = validarCampo('confirmPassword', valores);
    if (coincide) errores.confirmPassword = coincide;
  }
  return errores;
}
