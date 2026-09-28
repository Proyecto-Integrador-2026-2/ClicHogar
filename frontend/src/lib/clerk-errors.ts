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
