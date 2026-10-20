/**
 * Pruebas de la verificación de sesión Clerk sin red: `verifyToken` y
 * `fetch` (Backend API) se simulan. Se importa con un query para no
 * recibir el mock de `shared/auth/clerk` que usan otros tests.
 */
import { afterEach, describe, expect, mock, test } from 'bun:test';

process.env.DATABASE_URL ??= 'postgres://test';
process.env.CLERK_SECRET_KEY ??= 'sk_test';

let claims: Record<string, unknown> | Error = { sub: 'user_1' };

mock.module('@clerk/backend', () => ({
  verifyToken: async () => {
    if (claims instanceof Error) throw claims;
    return claims;
  },
}));

// Ruta en variable: TS no resuelve imports con query string; Bun sí.
const RUTA_REAL = './clerk.ts?real';
const { sesionDesdeHeaders, verificarSesionClerk } = (await import(
  RUTA_REAL
)) as typeof import('./clerk');

const fetchOriginal = globalThis.fetch;

function simularClerkApi(respuesta: Response | Error) {
  globalThis.fetch = (async () => {
    if (respuesta instanceof Error) throw respuesta;
    return respuesta;
  }) as unknown as typeof fetch;
}

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status });

afterEach(() => {
  globalThis.fetch = fetchOriginal;
  claims = { sub: 'user_1' };
});

describe('verificarSesionClerk: cabecera', () => {
  test('401 sin Authorization o sin esquema Bearer', async () => {
    await expect(verificarSesionClerk(undefined)).rejects.toThrow(
      'Falta el token de sesión.'
    );
    await expect(verificarSesionClerk('Basic abc')).rejects.toThrow(
      'Falta el token de sesión.'
    );
  });

  test('401 con Bearer vacío', async () => {
    await expect(verificarSesionClerk('Bearer    ')).rejects.toThrow(
      'Falta el token de sesión.'
    );
  });

  test('401 si Clerk rechaza el token', async () => {
    claims = new Error('expirado');
    await expect(verificarSesionClerk('Bearer t')).rejects.toThrow(
      'Sesión inválida o expirada.'
    );
  });

  test('401 si el token no trae sub', async () => {
    claims = {};
    await expect(verificarSesionClerk('Bearer t')).rejects.toThrow(
      'identidad válida'
    );
  });
});

describe('verificarSesionClerk: claims del token', () => {
  test('usa email, nombre y rol del token sin llamar a la API', async () => {
    claims = {
      sub: 'user_1',
      email: 'ANA@Ejemplo.com',
      name: 'Ana',
      public_metadata: { role: 'afiliado' },
    };
    globalThis.fetch = (() => {
      throw new Error('no debe llamarse');
    }) as unknown as typeof fetch;
    expect(await verificarSesionClerk('Bearer t')).toEqual({
      clerkId: 'user_1',
      email: 'ana@ejemplo.com',
      nombre: 'Ana',
      rolClerk: 'afiliado',
    });
  });

  test('sesionDesdeHeaders lee el header authorization', async () => {
    claims = { sub: 'u', email: 'a@b.c', first_name: 'Ana', rol: 'cliente' };
    const sesion = await sesionDesdeHeaders({ authorization: 'Bearer t' });
    expect(sesion.nombre).toBe('Ana');
    expect(sesion.rolClerk).toBe('cliente');
  });

  test('ignora metadata que no es objeto o no trae rol', async () => {
    claims = {
      sub: 'u',
      email: 'a@b.c',
      name: 'Ana',
      unsafe_metadata: 'texto',
      public_metadata: { otro: 1 },
    };
    expect((await verificarSesionClerk('Bearer t')).rolClerk).toBeUndefined();
  });

  test('toma el rol de unsafe_metadata', async () => {
    claims = {
      sub: 'u',
      email: 'a@b.c',
      name: 'Ana',
      unsafe_metadata: { rol: 'afiliado' },
    };
    expect((await verificarSesionClerk('Bearer t')).rolClerk).toBe('afiliado');
  });
});

describe('verificarSesionClerk: respaldo con la Backend API', () => {
  test('completa email, nombre y rol desde Clerk', async () => {
    simularClerkApi(
      json({
        email_addresses: [
          { id: 'e1', email_address: 'otro@x.com' },
          { id: 'e2', email_address: 'Ana@X.com' },
        ],
        primary_email_address_id: 'e2',
        first_name: 'Ana',
        last_name: 'Pérez',
        unsafe_metadata: { rol: 'afiliado' },
      })
    );
    expect(await verificarSesionClerk('Bearer t')).toEqual({
      clerkId: 'user_1',
      email: 'ana@x.com',
      nombre: 'Ana Pérez',
      rolClerk: 'afiliado',
    });
  });

  test('usa role como alternativa y el primer email si no hay principal', async () => {
    simularClerkApi(
      json({
        email_addresses: [{ id: 'e1', email_address: 'luis@x.com' }],
        unsafe_metadata: { rol: '  ', role: 'cliente' },
      })
    );
    const sesion = await verificarSesionClerk('Bearer t');
    expect(sesion.email).toBe('luis@x.com');
    expect(sesion.nombre).toBe('luis');
    expect(sesion.rolClerk).toBe('cliente');
  });

  test('sin metadata el rol queda indefinido', async () => {
    claims = { sub: 'user_1', name: 'Ana' };
    simularClerkApi(
      json({
        email_addresses: [{ id: 'e1', email_address: 'ana@x.com' }],
        unsafe_metadata: null,
      })
    );
    const sesion = await verificarSesionClerk('Bearer t');
    expect(sesion.nombre).toBe('Ana');
    expect(sesion.rolClerk).toBeUndefined();
  });

  test('401 si la API falla, no encuentra al usuario o no hay red', async () => {
    simularClerkApi(json({}, 404));
    await expect(verificarSesionClerk('Bearer t')).rejects.toThrow(
      'No se pudo confirmar la identidad.'
    );
    simularClerkApi(json({}, 500));
    await expect(verificarSesionClerk('Bearer t')).rejects.toThrow(
      'No se pudo confirmar la identidad.'
    );
    simularClerkApi(new Error('sin red'));
    await expect(verificarSesionClerk('Bearer t')).rejects.toThrow(
      'No se pudo confirmar la identidad.'
    );
  });

  test('401 si el usuario no tiene correos', async () => {
    simularClerkApi(json({}));
    await expect(verificarSesionClerk('Bearer t')).rejects.toThrow(
      'identidad válida'
    );
  });
});
