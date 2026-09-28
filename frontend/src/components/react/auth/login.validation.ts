/**
 * Reglas de validación del formulario de inicio de sesión (US-002).
 * Espejo de `register.validation.ts`: validación al blur (Esc 5-6),
 * saneamiento con trim antes de enviar (Esc 7/8) y resumen de errores.
 */

export type ValoresLogin = {
  email: string;
  password: string;
};

/** Claves con error visible. */
export type ClaveErrorLogin = 'email' | 'password';

/** Ids de ancla del formulario (prefijo ch- para no colisionar). */
export const IDS_LOGIN = {
  email: 'ch-login-email',
  password: 'ch-login-password',
} as const;

/** Etiquetas legibles para el resumen de errores. */
export const ETIQUETAS_LOGIN: Record<ClaveErrorLogin, string> = {
  email: 'Correo electrónico',
  password: 'Contraseña',
};

const EMAIL_REGEX = /^[^\s@]{1,64}@[^^\s@]{1,255}\.[^\s@]{2,63}$/;

/** Valida un campo y devuelve el mensaje a mostrar (o undefined si pasa). */
export function validarCampoLogin(
  campo: ClaveErrorLogin,
  v: ValoresLogin
): string | undefined {
  switch (campo) {
    case 'email':
      if (!v.email.trim()) return 'Este campo es obligatorio';
      if (!EMAIL_REGEX.test(v.email.trim())) {
        return 'Por favor, ingresa un correo electrónico válido';
      }
      return undefined;
    case 'password':
      if (!v.password) return 'Este campo es obligatorio';
      return undefined;
  }
}

/** Sanea la entrada antes de enviarla (Esc 7/8: trim + minúsculas). */
export function sanearEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Campos evaluados en cada validación (orden de presentación). */
export const CAMPOS_LOGIN: Array<ClaveErrorLogin> = ['email', 'password'];
