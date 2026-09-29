import type Elysia from 'elysia';
import { AppError } from './app-error';

/**
 * Handler de errores global de la app. Traduce:
 * - AppError (y subclases) -> su status + mensaje de dominio.
 * - Errores de validación de Elysia (schema DTO) -> 400.
 * - NOT_FOUND de rutas inexistentes -> 404.
 * - Cualquier otro error -> 500 genérico (sin filtrar detalles internos).
 */
export function registerErrorHandler(app: Elysia) {
  return app.onError(({ code, error, set }) => {
    if (error instanceof AppError) {
      set.status = error.status;
      return { error: error.name, message: error.message };
    }

    if (code === 'VALIDATION') {
      set.status = 400;
      return {
        error: 'ValidationError',
        message: 'Los datos enviados no son válidos.',
      };
    }

    // Elysia rechaza archivos con tipo/extensión inválidos (p. ej. un
    // script renombrado a .jpg) con estos códigos: también son 400,
    // nunca 500. El mensaje sigue genérico para no filtrar detalles.
    if (code === 'INVALID_FILE_TYPE' || code === 'PARSE') {
      set.status = 400;
      return {
        error: 'ValidationError',
        message: 'Los datos enviados no son válidos.',
      };
    }

    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { error: 'NotFoundError', message: 'Recurso no encontrado.' };
    }

    console.error(error);
    set.status = 500;
    return {
      error: 'InternalServerError',
      message: 'Ocurrió un error inesperado.',
    };
  });
}
