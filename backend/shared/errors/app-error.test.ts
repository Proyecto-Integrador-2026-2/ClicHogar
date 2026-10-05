/**
 * Pruebas de los errores de dominio. Cada subclase fija su status HTTP
 * y su mensaje por defecto; el handler global los traduce sin filtrar
 * detalles internos (ver `error-handler.ts`).
 */
import { describe, expect, test } from 'bun:test';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
  ValidationError,
} from './app-error';

describe('errores de dominio', () => {
  test('cada clase fija su status', () => {
    expect(new ValidationError().status).toBe(400);
    expect(new UnauthorizedError().status).toBe(401);
    expect(new ForbiddenError().status).toBe(403);
    expect(new NotFoundError().status).toBe(404);
    expect(new ConflictError().status).toBe(409);
    expect(new TooManyRequestsError().status).toBe(429);
  });

  test('mensajes por defecto orientan al usuario', () => {
    expect(new ValidationError().message).toContain('válidos');
    expect(new UnauthorizedError().message).toContain('autorizado');
    expect(new ForbiddenError().message).toContain('permisos');
    expect(new NotFoundError().message).toContain('no encontrado');
    expect(new ConflictError().message).toContain('ya existe');
    expect(new TooManyRequestsError().message).toContain('intentos');
  });

  test('el mensaje personalizado prevalece y el nombre identifica la clase', () => {
    const error = new NotFoundError('Sin perfil local.');
    expect(error.message).toBe('Sin perfil local.');
    expect(error.name).toBe('NotFoundError');
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
  });
});
