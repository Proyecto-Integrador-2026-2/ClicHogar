/**
 * Pruebas HTTP del módulo `usuarios` contra la app real con `app.handle()`:
 * sin puerto ni Postgres. La sesión se simula con `authService` y los
 * servicios con `spyOn`. Cubre controllers, DTOs y el mapeo de errores.
 */
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';

process.env.DATABASE_URL ??= 'postgres://test';

import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../../../shared/errors/app-error';
import { authService } from '../../auth/services/auth.service';
import type { Usuario } from '../entities/usuario.entity';
import { usuariosRepository } from '../repositories/usuarios.repository';
import { disponibilidadService } from '../services/disponibilidad.service';
import { perfilService } from '../services/perfil.service';

const { buildApp } = await import('../../../app');

const FECHA = new Date('2026-01-01T00:00:00.000Z');

const USUARIO: Usuario = {
  id: 'u-1',
  nombre: 'Ana',
  email: 'ana@ejemplo.com',
  passwordHash: 'hash-secreto',
  rol: 'cliente',
  fotoUrl: null,
  descripcion: null,
  ubicacion: null,
  activo: true,
  creadoEn: FECHA,
  actualizadoEn: FECHA,
};

const PERFIL_PUBLICO = {
  id: 'u-1',
  nombre: 'Ana',
  email: 'ana@ejemplo.com',
  rol: 'cliente' as const,
  fotoUrl: null,
  descripcion: null,
  ubicacion: null,
  creadoEn: FECHA,
};

afterEach(() => {
  mock.restore();
});

/** Sesión válida de `USUARIO` para las rutas protegidas. */
function conSesion() {
  return spyOn(authService, 'resolverUsuario').mockResolvedValue(USUARIO);
}

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

/** PATCH multipart con un archivo `foto`. */
function patchConFoto(bytes: Uint8Array, nombre: string, tipo: string) {
  const forma = new FormData();
  forma.append('foto', new File([bytes], nombre, { type: tipo }));
  return buildApp().handle(
    new Request('http://localhost/api/usuarios/yo', {
      method: 'PATCH',
      headers: { authorization: 'Bearer sesion-falsa' },
      body: forma,
    })
  );
}

describe('GET /api/usuarios/yo', () => {
  test('devuelve el perfil público (sin hash) con 200', async () => {
    // Given: una sesión válida
    conSesion();
    // When: se pide GET /api/usuarios/yo
    const res = await pedido('/api/usuarios/yo', 'GET');
    // Then: responde 200 con el correo y sin el hash de contraseña
    expect(res.status).toBe(200);
    const cuerpo = (await res.json()) as Record<string, unknown>;
    expect(cuerpo.email).toBe('ana@ejemplo.com');
    expect(cuerpo).not.toHaveProperty('passwordHash');
  });

  test('sin sesión responde 401', async () => {
    // Given: una sesión que no existe
    spyOn(authService, 'resolverUsuario').mockRejectedValue(
      new UnauthorizedError('Sesión inválida o expirada.')
    );
    // When: se pide GET /api/usuarios/yo
    const res = await pedido('/api/usuarios/yo', 'GET');
    // Then: responde 401
    expect(res.status).toBe(401);
  });
});

describe('GET /api/usuarios/:id (perfil público)', () => {
  test('200 sin sesión y sin datos sensibles', async () => {
    // Given: un usuario existente
    spyOn(usuariosRepository, 'buscarPorId').mockResolvedValue(USUARIO);
    // When: se pide sin cabecera Authorization
    const res = await buildApp().handle(
      new Request('http://localhost/api/usuarios/u-1')
    );
    // Then: responde 200 con la forma pública
    expect(res.status).toBe(200);
    const cuerpo = (await res.json()) as Record<string, unknown>;
    expect(cuerpo.nombre).toBe('Ana');
    expect(cuerpo).not.toHaveProperty('passwordHash');
  });

  test('404 si no existe', async () => {
    // Given: un usuario que no existe
    spyOn(usuariosRepository, 'buscarPorId').mockResolvedValue(undefined);
    // When: se pide
    const res = await pedido('/api/usuarios/no-existe', 'GET');
    // Then: responde 404 NotFoundError
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe(
      'NotFoundError'
    );
  });
});

describe('PATCH /api/usuarios/yo', () => {
  test('actualiza parcial con 200 usando el usuario de la sesión', async () => {
    // Given: una sesión válida y un servicio que acepta el patch
    conSesion();
    const actualizar = spyOn(
      perfilService,
      'actualizarPerfil'
    ).mockResolvedValue({ ...PERFIL_PUBLICO, descripcion: 'Plomera' });
    // When: se envía PATCH /api/usuarios/yo (multipart, sin foto)
    const forma = new FormData();
    forma.append('descripcion', 'Plomera');
    const res = await buildApp().handle(
      new Request('http://localhost/api/usuarios/yo', {
        method: 'PATCH',
        headers: { authorization: 'Bearer sesion-falsa' },
        body: forma,
      })
    );
    // Then: responde 200 y el servicio recibe el id de la sesión y no hay foto
    expect(res.status).toBe(200);
    expect(actualizar).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: 'u-1',
        descripcion: 'Plomera',
        foto: undefined,
      })
    );
  });

  test('acepta una foto PNG y la reenvía como bytes', async () => {
    // Given: una sesión válida y un servicio que acepta la foto
    conSesion();
    const actualizar = spyOn(
      perfilService,
      'actualizarPerfil'
    ).mockResolvedValue({
      ...PERFIL_PUBLICO,
      fotoUrl: '/uploads/perfiles/falsa.jpg',
    });
    // PNG mínimo válido: Elysia verifica la firma completa (8 bytes).
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
    ]);
    // When: se envía PATCH con la foto
    const res = await patchConFoto(png, 'foto.png', 'image/png');
    // Then: responde 200 y el servicio recibe la foto como bytes con su tamaño
    expect(res.status).toBe(200);
    expect(actualizar).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: 'u-1',
        foto: expect.objectContaining({
          mimeDeclarado: 'image/png',
          tamano: png.length,
        }),
      })
    );
  });

  test('un archivo que no es imagen responde 400, nunca 500', async () => {
    // Given: un script renombrado como .jpg
    conSesion();
    const actualizar = spyOn(perfilService, 'actualizarPerfil');
    const falso = new TextEncoder().encode('<script>alert(1)</script>');
    // When: se envía como foto
    const res = await patchConFoto(falso, 'foto.jpg', 'image/jpeg');
    // Then: responde 400 con el mensaje genérico y no llega al servicio
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe(
      'ValidationError'
    );
    expect(actualizar).not.toHaveBeenCalled();
  });
});

describe('disponibilidad', () => {
  test('PUT reemplaza con 200', async () => {
    // Given: una sesión válida y un servicio que guarda y devuelve una franja
    conSesion();
    const guardar = spyOn(disponibilidadService, 'guardar').mockResolvedValue([
      { diaSemana: 1, franjaHoraria: 'tarde' },
    ]);
    // When: se envía PUT /api/usuarios/disponibilidad
    const res = await pedido('/api/usuarios/disponibilidad', 'PUT', {
      slots: [{ dia: 1, franja: 'tarde' }],
    });
    // Then: responde 200 con la franja y usa el id de la sesión
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { diaSemana: 1, franjaHoraria: 'tarde' },
    ]);
    expect(guardar).toHaveBeenCalledWith('u-1', [{ dia: 1, franja: 'tarde' }]);
  });

  test('PUT con cliente responde 403', async () => {
    // Given: un servicio que rechaza porque el rol es cliente
    conSesion();
    spyOn(disponibilidadService, 'guardar').mockRejectedValue(
      new ForbiddenError('Esta sección es exclusiva para Afiliados.')
    );
    // When: se envía PUT /api/usuarios/disponibilidad
    const res = await pedido('/api/usuarios/disponibilidad', 'PUT', {
      slots: [],
    });
    // Then: responde 403
    expect(res.status).toBe(403);
  });

  test('PUT con cuerpo inválido responde 400', async () => {
    // Given: una sesión válida
    conSesion();
    // When: se envía un cuerpo sin slots
    const res = await pedido('/api/usuarios/disponibilidad', 'PUT', {});
    // Then: responde 400
    expect(res.status).toBe(400);
  });

  test('GET devuelve la matriz con 200 y propaga un 404 del servicio', async () => {
    // Given: una sesión válida y un servicio con la matriz vacía
    conSesion();
    const obtener = spyOn(disponibilidadService, 'obtener').mockResolvedValue(
      []
    );
    // When: se pide GET /api/usuarios/disponibilidad
    const ok = await pedido('/api/usuarios/disponibilidad', 'GET');
    // Then: responde 200 con un arreglo vacío
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual([]);
    // Given: ahora un servicio que lanza NotFoundError
    obtener.mockRejectedValue(new NotFoundError('Sin perfil.'));
    // When: se pide otra vez
    const noEncontrado = await pedido('/api/usuarios/disponibilidad', 'GET');
    // Then: el error de dominio se traduce a 404
    expect(noEncontrado.status).toBe(404);
  });
});
