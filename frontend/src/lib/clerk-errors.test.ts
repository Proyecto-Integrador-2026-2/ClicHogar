/**
 * Pruebas del clasificador de errores de inicio de sesión (US-002).
 * Garantizan que jamás se revele qué dato falló (Esc 3-4) y que el
 * bloqueo temporal tenga mensaje propio (Esc 9). Puras, sin Clerk.
 */
import { describe, expect, test } from 'bun:test';
import {
  clasificarErrorSignIn,
  mensajeErrorSignIn,
} from './clerk-errors';

function errorClerk(code: string, message = 'x') {
  return { errors: [{ code, message }] };
}

describe('clasificarErrorSignIn', () => {
  test('password incorrecta e identificador inexistente comparten clase (Esc 3-4)', () => {
    expect(clasificarErrorSignIn(errorClerk('form_password_incorrect'))).toEqual(
      { kind: 'credenciales' }
    );
    expect(
      clasificarErrorSignIn(errorClerk('form_identifier_not_found'))
    ).toEqual({ kind: 'credenciales' });
  });

  test('bloqueo/rate-limit se clasifica aparte (Esc 9)', () => {
    expect(
      clasificarErrorSignIn(errorClerk('session_locked', 'locked out'))
    ).toEqual({ kind: 'bloqueo' });
    expect(
      clasificarErrorSignIn(errorClerk('too_many_requests', 'slow down'))
    ).toEqual({ kind: 'bloqueo' });
  });

  test('error desconocido con mensaje se propaga', () => {
    expect(
      clasificarErrorSignIn(errorClerk('form_param_missing', 'Falta el código'))
    ).toEqual({ kind: 'otro', message: 'Falta el código' });
  });

  test('valor sin forma Clerk cae al genérico', () => {
    expect(clasificarErrorSignIn(new Error('boom'))).toEqual({
      kind: 'otro',
      message: 'Ocurrió un error al iniciar sesión.',
    });
    expect(clasificarErrorSignIn(undefined)).toEqual({
      kind: 'otro',
      message: 'Ocurrió un error al iniciar sesión.',
    });
  });
});

describe('mensajeErrorSignIn', () => {
  test('credenciales no revelan el dato fallido', () => {
    expect(mensajeErrorSignIn({ kind: 'credenciales' })).toBe(
      'Correo o contraseña incorrectos.'
    );
  });

  test('bloqueo anuncia la ventana de 15 minutos', () => {
    expect(mensajeErrorSignIn({ kind: 'bloqueo' })).toContain('15 minutos');
  });

  test('otro devuelve su mensaje', () => {
    expect(mensajeErrorSignIn({ kind: 'otro', message: 'Hola' })).toBe('Hola');
  });
});
