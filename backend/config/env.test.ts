/**
 * Pruebas de la validación de variables de entorno.
 */
import { afterEach, describe, expect, test } from 'bun:test';

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('config/env', () => {
  test('requireEnv lanza si falta la variable', async () => {
    process.env.DATABASE_URL = 'postgres://test';
    process.env.CLERK_SECRET_KEY = 'sk_test';
    const { requireEnv } = await import('./env');
    // Given: una variable de entorno que no existe
    delete process.env.VARIABLE_INEXISTENTE;
    // When: se exige con requireEnv
    // Then: lanza un error que nombra la variable
    expect(() => requireEnv('VARIABLE_INEXISTENTE')).toThrow(
      'VARIABLE_INEXISTENTE'
    );
  });

  test('requireEnv lanza si está en blanco y devuelve el valor si existe', async () => {
    process.env.DATABASE_URL = 'postgres://test';
    process.env.CLERK_SECRET_KEY = 'sk_test';
    const { requireEnv } = await import('./env');
    // Given: una variable con solo espacios
    process.env.VARIABLE_PRUEBA = '   ';
    // When: se exige con requireEnv
    expect(() => requireEnv('VARIABLE_PRUEBA')).toThrow('VARIABLE_PRUEBA');
    process.env.VARIABLE_PRUEBA = 'ok';
    // Then: en blanco lanza error, con valor lo devuelve
    expect(requireEnv('VARIABLE_PRUEBA')).toBe('ok');
  });

  test('usa los valores por defecto fuera de producción', async () => {
    process.env.DATABASE_URL = 'postgres://test';
    process.env.CLERK_SECRET_KEY = 'sk_test';
    // Given: un entorno sin NODE_ENV, PORT ni CORS_ORIGIN
    delete process.env.NODE_ENV;
    delete process.env.PORT;
    delete process.env.CORS_ORIGIN;
    // When: se carga el módulo de configuración
    const dev = await import('./env');
    // Then: usa los valores por defecto y no es producción
    expect(dev.env.PORT).toBe(3000);
    expect(dev.env.SESSION_COOKIE_NAME).toBe('clichogar_session');
    expect(dev.env.SESSION_TTL_SECONDS).toBe(604800);
    expect(dev.isProduction).toBe(false);
  });
});
