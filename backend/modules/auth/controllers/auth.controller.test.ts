/**
 * Pruebas HTTP de autenticación contra la app real con `app.handle()`:
 * sin puerto ni Postgres (el servicio se simula). Incluye el mapeo de
 * errores global (400 de validación, 401, 404 y 500 genérico).
 */
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';

process.env.DATABASE_URL ??= 'postgres://test';

import {
  ConflictError,
  UnauthorizedError,
} from '../../../shared/errors/app-error';
import { authService, type RespuestaSesion } from '../services/auth.service';

const { buildApp } = await import('../../../app');

const SESION: RespuestaSesion = {
  token: 'tok-123',
  usuario: {
    id: 'u-1',
    nombre: 'Ana',
    email: 'ana@ejemplo.com',
    rol: 'cliente',
    fotoUrl: null,
    descripcion: null,
    ubicacion: null,
    creadoEn: new Date('2026-01-01T00:00:00.000Z'),
  },
};

afterEach(() => {
  mock.restore();
});

function pedido(
  ruta: string,
  metodo: string,
  cuerpo?: unknown,
  headers: Record<string, string> = {}
) {
  return buildApp().handle(
    new Request(`http://localhost${ruta}`, {
      method: metodo,
      headers: { 'content-type': 'application/json', ...headers },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    })
  );
}

describe('POST /api/auth/register', () => {
  test('201 con token y usuario', async () => {
    // Given: un servicio que crea la cuenta
    const register = spyOn(authService, 'register').mockResolvedValue(SESION);
    // When: se registra
    const res = await pedido('/api/auth/register', 'POST', {
      nombre: 'Ana',
      email: 'ana@ejemplo.com',
      password: 'Secreta123',
      rol: 'afiliado',
    });
    // Then: responde 201 con el token
    expect(res.status).toBe(201);
    expect(((await res.json()) as RespuestaSesion).token).toBe('tok-123');
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ana@ejemplo.com', rol: 'afiliado' })
    );
  });

  test('400 si falta el correo o la contraseña', async () => {
    // Given: cuerpos incompletos o con tipos incorrectos
    // When / Then: cada uno responde 400 con el error de validación
    for (const cuerpo of [
      { password: 'Secreta123' },
      { email: 'a@b.co' },
      { email: 42, password: 'Secreta123' },
    ]) {
      const res = await pedido('/api/auth/register', 'POST', cuerpo);
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error: string }).error).toBe(
        'ValidationError'
      );
    }
  });

  test('409 si el correo ya existe', async () => {
    // Given: un servicio que detecta el correo repetido
    spyOn(authService, 'register').mockRejectedValue(
      new ConflictError('Ya existe una cuenta con ese email.')
    );
    // When: se registra
    const res = await pedido('/api/auth/register', 'POST', {
      email: 'ana@ejemplo.com',
      password: 'Secreta123',
    });
    // Then: responde 409 con el mensaje
    expect(res.status).toBe(409);
    expect(((await res.json()) as { message: string }).message).toContain(
      'Ya existe'
    );
  });
});

describe('POST /api/auth/login', () => {
  test('200 con token', async () => {
    // Given: un servicio que acepta las credenciales
    spyOn(authService, 'login').mockResolvedValue(SESION);
    // When: se inicia sesión
    const res = await pedido('/api/auth/login', 'POST', {
      email: 'ana@ejemplo.com',
      password: 'Secreta123',
    });
    // Then: responde 200
    expect(res.status).toBe(200);
    expect(((await res.json()) as RespuestaSesion).token).toBe('tok-123');
  });

  test('401 con credenciales inválidas', async () => {
    // Given: un servicio que rechaza las credenciales
    spyOn(authService, 'login').mockRejectedValue(
      new UnauthorizedError('Credenciales inválidas.')
    );
    // When: se inicia sesión
    const res = await pedido('/api/auth/login', 'POST', {
      email: 'ana@ejemplo.com',
      password: 'mala-clave',
    });
    // Then: responde 401
    expect(res.status).toBe(401);
  });

  test('un JSON mal formado responde 400, no 500', async () => {
    // Given: un cuerpo que no es JSON válido
    // When: se envía con content-type JSON
    const res = await buildApp().handle(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{no es json',
      })
    );
    // Then: responde 400 con el error de validación
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe(
      'ValidationError'
    );
  });
});

describe('GET /api/auth/me y POST /api/auth/logout', () => {
  test('me usa el token Bearer', async () => {
    // Given: un servicio que resuelve el token
    const me = spyOn(authService, 'me').mockResolvedValue(SESION.usuario);
    // When: se pide la sesión actual con Bearer
    const res = await pedido('/api/auth/me', 'GET', undefined, {
      authorization: 'Bearer tok-123',
    });
    // Then: responde 200 y el servicio recibió el token
    expect(res.status).toBe(200);
    expect(me).toHaveBeenCalledWith('tok-123');
  });

  test('me sin token responde 401', async () => {
    // Given: un servicio que rechaza el token vacío
    spyOn(authService, 'me').mockRejectedValue(
      new UnauthorizedError('Sesión inválida o expirada.')
    );
    // When: se pide sin Authorization
    const res = await pedido('/api/auth/me', 'GET');
    // Then: responde 401
    expect(res.status).toBe(401);
  });

  test('logout elimina la sesión y responde ok', async () => {
    // Given: un servicio de logout
    const logout = spyOn(authService, 'logout').mockResolvedValue();
    // When: se cierra la sesión
    const res = await pedido('/api/auth/logout', 'POST', undefined, {
      authorization: 'Bearer tok-123',
    });
    // Then: responde { ok: true } y se pasó el token
    expect(await res.json()).toEqual({ ok: true });
    expect(logout).toHaveBeenCalledWith('tok-123');
  });
});

describe('errores globales', () => {
  test('ruta inexistente responde 404', async () => {
    // Given: una ruta que no existe
    // When: se pide
    const res = await pedido('/api/no-existe', 'GET');
    // Then: responde 404 NotFoundError
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe(
      'NotFoundError'
    );
  });

  test('un fallo inesperado responde 500 sin filtrar el detalle', async () => {
    // Given: un servicio que lanza un error inesperado
    spyOn(console, 'error').mockImplementation(() => {});
    spyOn(authService, 'me').mockRejectedValue(new Error('caída de BD'));
    // When: se pide la sesión actual
    const res = await pedido('/api/auth/me', 'GET');
    // Then: responde 500 genérico
    expect(res.status).toBe(500);
    const cuerpo = (await res.json()) as { error: string; message: string };
    expect(cuerpo.error).toBe('InternalServerError');
    expect(cuerpo.message).not.toContain('caída');
  });
});
