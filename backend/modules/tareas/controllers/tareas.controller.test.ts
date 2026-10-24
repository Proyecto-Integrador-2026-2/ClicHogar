/**
 * Pruebas HTTP del módulo `tareas` (US-006/008) contra la app real con
 * `app.handle()`: sin puerto, sin Postgres y sin Clerk. La sesión se
 * simula con `mock.module` y el servicio con `spyOn`.
 */
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';

process.env.DATABASE_URL ??= 'postgres://test';
process.env.CLERK_SECRET_KEY ??= 'sk_test';

import { UnauthorizedError } from '../../../shared/errors/app-error';
import type { SesionClerk } from '../../../shared/auth/clerk';
import { tareasService } from '../services/tareas.service';

const SESION: SesionClerk = {
  clerkId: 'clerk-1',
  email: 'ana@ejemplo.com',
  nombre: 'Ana',
  rolClerk: undefined,
};

let comportamientoSesion: () => Promise<SesionClerk> = async () => SESION;

mock.module('../../../shared/auth/clerk', () => ({
  sesionDesdeHeaders: (...args: unknown[]) =>
    comportamientoSesion(...(args as [])),
}));

const { buildApp } = await import('../../../app');

afterEach(() => {
  mock.restore();
  comportamientoSesion = async () => SESION;
});

function pedido(
  ruta: string,
  metodo: string,
  cuerpo?: unknown,
  token = 'Bearer sesion-falsa'
) {
  return buildApp().handle(
    new Request(`http://localhost${ruta}`, {
      method: metodo,
      headers: {
        'content-type': 'application/json',
        authorization: token,
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    })
  );
}

const TAREA_PUBLICA = {
  id: 't-1',
  titulo: 'Arreglar grifo que gotea',
  descripcion: 'El grifo de la cocina gotea día y noche y ya manchó el mueble.',
  categoria: 'Plomería',
  estado: 'abierta',
  ubicacion: 'Belén, Medellín',
  latitud: null,
  longitud: null,
  autorNombre: 'Ana',
  creadoEn: new Date('2026-02-01T00:00:00.000Z'),
};

const CUERPO_VALIDO = {
  titulo: 'Arreglar grifo que gotea',
  descripcion: 'El grifo de la cocina gotea día y noche y ya manchó el mueble.',
  categoria: 'Plomería',
  ubicacion: 'Belén, Medellín',
};

describe('POST /api/tareas', () => {
  test('publica con 201 usando el clerkId de la sesión', async () => {
    // Given: una sesión válida de Clerk y un servicio que devuelve la tarea creada
    const crear = spyOn(tareasService, 'crearTarea');
    crear.mockResolvedValue(TAREA_PUBLICA);

    // When: se envía POST /api/tareas con un cuerpo válido
    const respuesta = await pedido('/api/tareas', 'POST', CUERPO_VALIDO);

    // Then: responde 201 y el servicio recibe el clerkId de la sesión
    expect(respuesta.status).toBe(201);
    expect(crear).toHaveBeenCalledWith(
      'clerk-1',
      expect.objectContaining({ titulo: CUERPO_VALIDO.titulo })
    );
    const cuerpo = (await respuesta.json()) as { id: string };
    expect(cuerpo.id).toBe('t-1');
  });

  test('cuerpo inválido responde 400 sin tocar el servicio', async () => {
    // Given: un cuerpo con título vacío y un servicio espiado
    const crear = spyOn(tareasService, 'crearTarea');

    // When: se envía POST /api/tareas
    const respuesta = await pedido('/api/tareas', 'POST', { titulo: '' });

    // Then: responde 400 de validación y el servicio no se toca
    expect(respuesta.status).toBe(400);
    expect(crear).not.toHaveBeenCalled();
    const cuerpo = (await respuesta.json()) as { error: string };
    expect(cuerpo.error).toBe('ValidationError');
  });

  test('JSON malformado responde 400 genérico (PARSE)', async () => {
    // Given: un cuerpo que no es JSON válido
    // When: se envía POST /api/tareas
    const respuesta = await buildApp().handle(
      new Request('http://localhost/api/tareas', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer sesion-falsa',
        },
        body: '{titulo: sin comillas',
      })
    );

    // Then: responde 400 genérico, sin detalles internos
    expect(respuesta.status).toBe(400);
    const cuerpo = (await respuesta.json()) as { error: string };
    expect(cuerpo.error).toBe('ValidationError');
  });

  test('sin sesión responde 401 (Escenario 7)', async () => {
    // Given: una sesión que Clerk rechaza
    comportamientoSesion = async () => {
      throw new UnauthorizedError('Sesión inválida.');
    };

    // When: se envía POST /api/tareas
    const respuesta = await pedido('/api/tareas', 'POST', CUERPO_VALIDO);

    // Then: responde 401 UnauthorizedError
    expect(respuesta.status).toBe(401);
    const cuerpo = (await respuesta.json()) as { error: string };
    expect(cuerpo.error).toBe('UnauthorizedError');
  });
});

describe('GET /api/tareas', () => {
  test('lista el tablero con 200', async () => {
    // Given: un servicio con una tarea abierta
    spyOn(tareasService, 'listarAbiertas').mockResolvedValue([TAREA_PUBLICA]);

    // When: se pide GET /api/tareas
    const respuesta = await pedido('/api/tareas', 'GET');

    // Then: responde 200 con la tarea del tablero
    expect(respuesta.status).toBe(200);
    const cuerpo = (await respuesta.json()) as Array<{ id: string }>;
    expect(cuerpo).toHaveLength(1);
    expect(cuerpo[0].id).toBe('t-1');
  });
});
