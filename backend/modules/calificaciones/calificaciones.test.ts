/**
 * Pruebas del módulo calificaciones: servicio y endpoints HTTP (app real
 * con `app.handle`; sesión y repositorios simulados).
 */
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';

process.env.DATABASE_URL ??= 'postgres://test';

import { authService } from '../auth/services/auth.service';
import type { Usuario } from '../usuarios/entities/usuario.entity';
import { usuariosRepository } from '../usuarios/repositories/usuarios.repository';
import {
  calificacionesRepository,
  type CalificacionFila,
} from './repositories/calificaciones.repository';
import { calificacionesService } from './services/calificaciones.service';

const { buildApp } = await import('../../app');

const YO = '11111111-1111-4111-8111-111111111111';
const OTRO = '22222222-2222-4222-8222-222222222222';
const TAREA = '33333333-3333-4333-8333-333333333333';

const FILA: CalificacionFila = {
  id: 'c1',
  tarea_id: null,
  autor_id: YO,
  destinatario_id: OTRO,
  puntuacion: 5,
  comentario: null,
  creado_en: new Date('2026-01-01T00:00:00.000Z'),
};

afterEach(() => {
  mock.restore();
});

function pedido(ruta: string, metodo: string, cuerpo?: unknown) {
  return buildApp().handle(
    new Request(`http://localhost${ruta}`, {
      method: metodo,
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer tok',
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    })
  );
}

describe('calificacionesService.crear', () => {
  test('guarda la calificación con tarea y comentario recortado', async () => {
    // Given: un destinatario existente
    spyOn(usuariosRepository, 'buscarPorId').mockResolvedValue({
      id: OTRO,
    } as Usuario);
    const crear = spyOn(calificacionesRepository, 'crear').mockResolvedValue(
      FILA
    );
    // When: se califica con tarea y un comentario con espacios
    const resultado = await calificacionesService.crear(YO, {
      destinatarioId: OTRO,
      tareaId: TAREA,
      puntuacion: 4,
      comentario: '  Muy bien  ',
    });
    // Then: se guarda recortado y se devuelve la fila
    expect(crear).toHaveBeenCalledWith({
      autorId: YO,
      destinatarioId: OTRO,
      tareaId: TAREA,
      puntuacion: 4,
      comentario: 'Muy bien',
    });
    expect(resultado).toBe(FILA);
  });

  test('sin tarea ni comentario guarda null', async () => {
    // Given: un destinatario existente
    spyOn(usuariosRepository, 'buscarPorId').mockResolvedValue({
      id: OTRO,
    } as Usuario);
    const crear = spyOn(calificacionesRepository, 'crear').mockResolvedValue(
      FILA
    );
    // When: se califica con comentario en blanco y sin tarea
    await calificacionesService.crear(YO, {
      destinatarioId: OTRO,
      puntuacion: 5,
      comentario: '   ',
    });
    // Then: tarea y comentario viajan como null
    expect(crear).toHaveBeenCalledWith(
      expect.objectContaining({ tareaId: null, comentario: null })
    );
  });

  test('no permite calificarse a sí mismo ni a un usuario inexistente', async () => {
    const buscar = spyOn(usuariosRepository, 'buscarPorId').mockResolvedValue(
      undefined
    );
    const crear = spyOn(calificacionesRepository, 'crear');
    // Given / When / Then: calificarse a uno mismo
    await expect(
      calificacionesService.crear(YO, { destinatarioId: YO, puntuacion: 5 })
    ).rejects.toThrow('a ti mismo');
    // Given / When / Then: un destinatario que no existe
    await expect(
      calificacionesService.crear(YO, { destinatarioId: OTRO, puntuacion: 5 })
    ).rejects.toThrow('Usuario no encontrado.');
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(crear).not.toHaveBeenCalled();
  });

  test('listarPorUsuario delega en el repositorio', async () => {
    // Given: un repositorio con una calificación
    const listar = spyOn(
      calificacionesRepository,
      'listarPorDestinatario'
    ).mockResolvedValue([FILA]);
    // When: se listan las del usuario
    // Then: devuelve la lista
    expect(await calificacionesService.listarPorUsuario(OTRO)).toEqual([FILA]);
    expect(listar).toHaveBeenCalledWith(OTRO);
  });
});

describe('POST /api/calificaciones', () => {
  test('201; el autor sale de la sesión', async () => {
    // Given: una sesión válida y un servicio que guarda
    spyOn(authService, 'resolverUsuario').mockResolvedValue({
      id: YO,
    } as Usuario);
    const crear = spyOn(calificacionesService, 'crear').mockResolvedValue(FILA);
    // When: se califica con tarea y comentario nulos
    const res = await pedido('/api/calificaciones', 'POST', {
      destinatarioId: OTRO,
      tareaId: null,
      puntuacion: 5,
      comentario: null,
    });
    // Then: responde 201 y el autor es el de la sesión
    expect(res.status).toBe(201);
    expect(crear).toHaveBeenCalledWith(
      YO,
      expect.objectContaining({ destinatarioId: OTRO, puntuacion: 5 })
    );
  });

  test('400 con puntuación fuera de 1-5, no entera o ids inválidos', async () => {
    spyOn(authService, 'resolverUsuario').mockResolvedValue({
      id: YO,
    } as Usuario);
    // Given / When / Then: cada cuerpo inválido responde 400
    for (const cuerpo of [
      { destinatarioId: OTRO, puntuacion: 99 },
      { destinatarioId: OTRO, puntuacion: 0 },
      { destinatarioId: OTRO, puntuacion: 4.5 },
      { destinatarioId: 'no-uuid', puntuacion: 5 },
      { destinatarioId: OTRO, tareaId: 'no-uuid', puntuacion: 5 },
      { destinatarioId: OTRO, puntuacion: 5, comentario: 'x'.repeat(501) },
    ]) {
      expect((await pedido('/api/calificaciones', 'POST', cuerpo)).status).toBe(
        400
      );
    }
  });

  test('401 sin sesión', async () => {
    // Given: una petición sin token
    // When: se intenta calificar
    const res = await buildApp().handle(
      new Request('http://localhost/api/calificaciones', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ destinatarioId: OTRO, puntuacion: 5 }),
      })
    );
    // Then: responde 401 (token vacío)
    expect(res.status).toBe(401);
  });
});

describe('GET /api/calificaciones/usuario/:id', () => {
  test('200 público, sin sesión', async () => {
    // Given: un servicio con una calificación
    spyOn(calificacionesService, 'listarPorUsuario').mockResolvedValue([FILA]);
    // When: se pide sin cabecera Authorization
    const res = await buildApp().handle(
      new Request(`http://localhost/api/calificaciones/usuario/${OTRO}`)
    );
    // Then: responde 200 con la lista
    expect(res.status).toBe(200);
    expect(((await res.json()) as CalificacionFila[])[0]?.id).toBe('c1');
  });

  test('400 si el id no es uuid', async () => {
    // Given: un id inválido
    // When: se pide
    const res = await pedido('/api/calificaciones/usuario/abc', 'GET');
    // Then: responde 400
    expect(res.status).toBe(400);
  });
});
