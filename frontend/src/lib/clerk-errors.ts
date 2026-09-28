/**
 * Lectura defensiva de errores de Clerk.
 * Clerk devuelve `{ errors: [{ code, message }] }`; cualquier otra forma
 * (p. ej. un Error plano del backend) devuelve undefined para que el
 * llamador no confunda un fallo de red con un error de formulario.
 */

export type ClerkError = {
  code?: string;
  message?: string;
};

/** Extrae el primer error de Clerk, si el valor trae esa forma. */
export function getFirstClerkError(error: unknown): ClerkError | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const errors = (error as { errors?: unknown }).errors;

  if (!Array.isArray(errors)) {
    return undefined;
  }

  const firstError = errors[0];

  if (typeof firstError !== 'object' || firstError === null) {
    return undefined;
  }

  const { code, message } = firstError as {
    code?: unknown;
    message?: unknown;
  };

  return {
    code: typeof code === 'string' ? code : undefined,
    message: typeof message === 'string' ? message : undefined,
  };
}

/**
 * Clasificación de errores de inicio de sesión (US-002, Esc 3-4 y 9).
 * Nunca revela qué dato falló: identificador inexistente y contraseña
 * incorrecta comparten el mensaje genérico. El bloqueo temporal tiene
 * mensaje propio.
 */
export type ErrorSignIn =
  | { kind: 'credenciales' }
  | { kind: 'bloqueo' }
  | { kind: 'otro'; message: string };

const MENSAJE_CREDENCIALES = 'Correo o contraseña incorrectos.';
const MENSAJE_BLOQUEO =
  'Cuenta bloqueada temporalmente por demasiados intentos. Inténtalo en 15 minutos.';

export function clasificarErrorSignIn(error: unknown): ErrorSignIn {
  const clerkError = getFirstClerkError(error);
  const codigo = clerkError?.code ?? '';
  const texto = `${codigo} ${clerkError?.message ?? ''}`.toLowerCase();
  // Códigos Clerk: form_password_incorrect, form_identifier_not_found.
  if (
    codigo === 'form_password_incorrect' ||
    codigo === 'form_identifier_not_found'
  ) {
    return { kind: 'credenciales' };
  }
  // Bloqueo/rate-limit de Clerk (Escenario 9).
  if (/lock|bloque|too[_-]?many|rate|429/.test(texto)) {
    return { kind: 'bloqueo' };
  }
  if (clerkError?.message) {
    return { kind: 'otro', message: clerkError.message };
  }
  return { kind: 'otro', message: 'Ocurrió un error al iniciar sesión.' };
}

/** Mensaje final para la UI según la clasificación. */
export function mensajeErrorSignIn(clasificado: ErrorSignIn): string {
  switch (clasificado.kind) {
    case 'credenciales':
      return MENSAJE_CREDENCIALES;
    case 'bloqueo':
      return MENSAJE_BLOQUEO;
    case 'otro':
      return clasificado.message;
  }
}
