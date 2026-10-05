/**
 * Pruebas HTTP del módulo `usuarios` contra la app real con `app.handle()`:
 * sin puerto, sin Postgres y sin Clerk. Cubre controllers, DTOs y el
 * mapeo de errores (401/403/404/400/500) del handler global.
 */
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';

process.env.DATABASE_URL ??= 'postgres://test';
process.env.CLERK_SECRET_KEY ??= 'sk_test';

import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../../../shared/errors/app-error';
import type { SesionClerk } from '../../../shared/auth/clerk';
import { disponibilidadService } from '../services/disponibilidad.service';
import { perfilService } from '../services/perfil.service';
import { registroService } from '../services/registro.service';
import { usuariosRepository } from '../repositories/usuarios.repository';

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

function pedido(ruta: string, metodo: string, cuerpo?: unknown) {
  return buildApp().handle(
    new Request(`http://localhost${ruta}`, {
      method: metodo,
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer sesion-falsa',
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    })
  );
}

const PERFIL_PUBLICO = {
  id: 'u-1',
  nombre: 'Ana',
  email: 'ana@ejemplo.com',
  rol: 'cliente',
  fotoUrl: null,
  descripcion: null,
  ubicacion: null,
  creadoEn: new Date('2026-01-01T00:00:00.000Z'),
};

const FILA_USUARIO = {
  ...PERFIL_PUBLICO,
  clerkId: 'clerk-1',
  passwordHash: null,
  activo: true,
  actualizadoEn: new Date('2026-01-01T00:00:00.000Z'),
};

describe('POST /api/usuarios/sync', () => {
  test('nuevo devuelve 201, existente 200', async () => {
    const sincronizar = spyOn(registroService, 'sincronizarDesdeClerk');
    sincronizar.mockResolvedValue({
      usuario: PERFIL_PUBLICO,
      creado: true,
    });

    const creado = await pedido('/api/usuarios/sync', 'POST', {
      nombre: 'Ana',
    });
    expect(creado.status).toBe(201);

    sincronizar.mockResolvedValue({
      usuario: PERFIL_PUBLICO,
      creado: false,
    });
    const existente = await pedido('/api/usuarios/sync', 'POST', {});
    expect(existente.status).toBe(200);
  });
});

describe('GET /api/usuarios/yo', () => {
  test('devuelve el perfil con 200', async () => {
    spyOn(usuariosRepository, 'buscarPorClerkId').mockResolvedValue(
      FILA_USUARIO
    );

    const respuesta = await pedido('/api/usuarios/yo', 'GET');

    expect(respuesta.status).toBe(200);
    const cuerpo = (await respuesta.json()) as { email: string };
    expect(cuerpo.email).toBe('ana@ejemplo.com');
  });

  test('sin fila local responde 404', async () => {
    spyOn(usuariosRepository, 'buscarPorClerkId').mockResolvedValue(null);

    const respuesta = await pedido('/api/usuarios/yo', 'GET');

    expect(respuesta.status).toBe(404);
    const cuerpo = (await respuesta.json()) as { error: string };
    expect(cuerpo.error).toBe('NotFoundError');
  });

  test('fallo inesperado responde 500 genérico', async () => {
    const consola = spyOn(console, 'error');
    consola.mockImplementation(() => {});
    spyOn(usuariosRepository, 'buscarPorClerkId').mockRejectedValue(
      new Error('caída de BD')
    );

    const respuesta = await pedido('/api/usuarios/yo', 'GET');

    expect(respuesta.status).toBe(500);
    const cuerpo = (await respuesta.json()) as {
      error: string;
      message: string;
    };
    expect(cuerpo.error).toBe('InternalServerError');
    expect(cuerpo.message).not.toContain('caída');
  });
});

describe('PATCH /api/usuarios/yo', () => {
  test('actualiza parcial con 200', async () => {
    const actualizar = spyOn(perfilService, 'actualizarPerfil');
    actualizar.mockResolvedValue({
      ...PERFIL_PUBLICO,
      descripcion: 'Plomera',
    });

    const respuesta = await pedido('/api/usuarios/yo', 'PATCH', {
      descripcion: 'Plomera',
    });

    expect(respuesta.status).toBe(200);
    expect(actualizar).toHaveBeenCalledWith(
      expect.objectContaining({ clerkId: 'clerk-1', descripcion: 'Plomera' })
    );
  });

  test('acepta foto PNG multipart y la reenvía como bytes', async () => {
    const actualizar = spyOn(perfilService, 'actualizarPerfil');
    actualizar.mockResolvedValue({
      ...PERFIL_PUBLICO,
      fotoUrl: '/uploads/perfiles/falsa.jpg',
    });
    // PNG mínimo válido: Elysia verifica la firma completa (8 bytes).
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
    ]);
    const forma = new FormData();
    forma.append('foto', new File([png], 'foto.png', { type: 'image/png' }));

    const respuesta = await buildApp().handle(
      new Request('http://localhost/api/usuarios/yo', {
        method: 'PATCH',
        headers: { authorization: 'Bearer sesion-falsa' },
        body: forma,
      })
    );

    expect(respuesta.status).toBe(200);
    expect(actualizar).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkId: 'clerk-1',
        foto: expect.objectContaining({
          mimeDeclarado: 'image/png',
          tamano: png.length,
        }),
      })
    );
  });
});

describe('disponibilidad', () => {
  test('PUT reemplaza con 200', async () => {
    const slots = [{ diaSemana: 1, franjaHoraria: 'tarde' }];
    spyOn(disponibilidadService, 'guardar').mockResolvedValue(slots);

    const respuesta = await pedido('/api/usuarios/disponibilidad', 'PUT', {
      slots: [{ dia: 1, franja: 'tarde' }],
    });

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual([
      { diaSemana: 1, franjaHoraria: 'tarde' },
    ]);
  });

  test('PUT con cliente responde 403', async () => {
    spyOn(disponibilidadService, 'guardar').mockRejectedValue(
      new ForbiddenError(
        'Esta sección es exclusiva para perfiles de Afiliados.'
      )
    );

    const respuesta = await pedido('/api/usuarios/disponibilidad', 'PUT', {
      slots: [],
    });

    expect(respuesta.status).toBe(403);
  });

  test('GET devuelve la matriz con 200', async () => {
    spyOn(disponibilidadService, 'obtener').mockResolvedValue([]);

    const respuesta = await pedido('/api/usuarios/disponibilidad', 'GET');

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual([]);
  });
});

describe('POST /api/usuarios (legacy)', () => {
  test('registra con 201', async () => {
    spyOn(registroService, 'registrarUsuario').mockResolvedValue(
      PERFIL_PUBLICO
    );

    const respuesta = await pedido('/api/usuarios', 'POST', {
      nombre: 'Ana',
      email: 'ana@ejemplo.com',
      password: 'Secreta123',
    });

    expect(respuesta.status).toBe(201);
  });
});

describe('errores globales', () => {
  test('sin sesión responde 401', async () => {
    comportamientoSesion = async () => {
      throw new UnauthorizedError('Sesión inválida.');
    };

    const respuesta = await pedido('/api/usuarios/yo', 'GET');

    expect(respuesta.status).toBe(401);
  });

  test('ruta inexistente responde 404', async () => {
    const respuesta = await pedido('/api/no-existe', 'GET');

    expect(respuesta.status).toBe(404);
    const cuerpo = (await respuesta.json()) as { error: string };
    expect(cuerpo.error).toBe('NotFoundError');
  });

  test('NotFoundError del servicio se traduce', async () => {
    spyOn(disponibilidadService, 'obtener').mockRejectedValue(
      new NotFoundError('Sin perfil.')
    );

    const respuesta = await pedido('/api/usuarios/disponibilidad', 'GET');

    expect(respuesta.status).toBe(404);
  });
});
