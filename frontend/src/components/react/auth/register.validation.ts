/**
 * Reglas de validación del formulario de registro (US-001).
 * Viven fuera del componente para que la UI solo orqueste estado:
 * los mensajes son los criterios de aceptación Esc 4–9 y se comparten
 * entre la validación al blur, al submit y el resumen de errores.
 */

/** Roles del selector: etiquetas de UI (el backend recibe cliente/afiliado). */
export type Role = 'Usuario' | 'Afiliado' | '';

/** Estado controlado del formulario. */
export type Valores = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: Role;
  termsAccepted: boolean;
};

/** Claves con error visible (el código de verificación vive aparte). */
export type ClaveError =
  'name' | 'email' | 'password' | 'confirmPassword' | 'role' | 'terms';

/** Ids de ancla del formulario (prefijo ch- para no colisionar). */
export const IDS = {
  name: 'ch-name',
  email: 'ch-email',
  password: 'ch-password',
  confirmPassword: 'ch-confirm-password',
  role: 'ch-role',
  terms: 'ch-terms',
  code: 'ch-code',
} as const;

/** Etiquetas legibles para el resumen de errores. */
export const ETIQUETAS: Record<
  keyof Omit<Valores, 'termsAccepted'> | 'terms',
  string
> = {
  name: 'Nombre completo',
  email: 'Correo electrónico',
  password: 'Contraseña',
  confirmPassword: 'Confirmar contraseña',
  role: 'Rol',
  terms: 'Términos y condiciones',
};

const EMAIL_REGEX = /^[^\s@]{1,64}@[^^\s@]{1,255}\.[^\s@]{2,63}$/;
// Mínimo 8 caracteres, al menos una mayúscula y un número (Escenario 8).
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

const OBLIGATORIO = 'Este campo es obligatorio';

/** Un validador por campo: devuelve el mensaje o undefined si pasa. */
const VALIDADORES: Record<ClaveError, (v: Valores) => string | undefined> = {
  name: (v) => (v.name.trim() ? undefined : OBLIGATORIO),
  email: (v) => {
    if (!v.email.trim()) return OBLIGATORIO;
    return EMAIL_REGEX.test(v.email)
      ? undefined
      : 'Por favor, ingresa un correo electrónico válido';
  },
  password: (v) => {
    if (!v.password) return OBLIGATORIO;
    return PASSWORD_REGEX.test(v.password)
      ? undefined
      : 'La contraseña debe tener al menos 8 caracteres, incluir números y mayúsculas';
  },
  confirmPassword: (v) =>
    v.password && v.confirmPassword && v.password !== v.confirmPassword
      ? 'Las contraseñas no coinciden'
      : undefined,
  role: (v) =>
    v.role ? undefined : 'Por favor, selecciona cómo deseas usar la plataforma',
  terms: (v) =>
    v.termsAccepted
      ? undefined
      : 'Debes aceptar los Términos, Condiciones y Política de Datos',
};

/** Valida un campo y devuelve el mensaje a mostrar (o undefined si pasa). */
export function validarCampo(
  campo: keyof Valores | 'terms',
  v: Valores
): string | undefined {
  return VALIDADORES[campo as ClaveError](v);
}

/** Campos evaluados en cada validación (orden de presentación). */
export const CAMPOS_VALIDABLES: Array<ClaveError> = [
  'name',
  'email',
  'password',
  'confirmPassword',
  'role',
  'terms',
];
