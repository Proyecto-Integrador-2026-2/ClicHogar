/**
 * Pruebas del módulo chat: servicio y endpoints HTTP (app real con
 * `app.handle`, sin puerto ni Postgres; la sesión y los repositorios se
 * simulan).
 */
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';

process.env.DATABASE_URL ??= 'postgres://test';

import { UnauthorizedError } from '../../shared/errors/app-error';
import { authService } from '../auth/services/auth.service';
import type { Usuario } from '../usuarios/entities/usuario.entity';
import { usuariosRepository } from '../usuarios/repositories/usuarios.repository';
import {
  chatRepository,
  type MensajeFila,
} from './repositories/chat.repository';
import { chatService } from './services/chat.service';

const { buildApp } = await import('../../app');

const YO = '11111111-1111-4111-8111-111111111111';
const OTRO = '22222222-2222-4222-8222-222222222222';
const FECHA = new Date('2026-01-01T00:00:00.000Z');

const MENSAJE: MensajeFila = {
  id: 'm1',
  remitente_id: YO,
  destinatario_id: OTRO,
  contenido: 'Hola',
  creado_en: FECHA,
};

afterEach(() => {
  mock.restore();
});

function sesion() {
  spyOn(authService, 'resolverUsuario').mockResolvedValue({
    id: YO,
  } as Usuario);
}

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

describe('chatService', () => {
  test('enviar guarda el mensaje recortado para un destinatario existente', async () => {
    // Given: un destinatario existente y un repositorio que guarda
    spyOn(usuariosRepository, 'buscarPorId').mockResolvedValue({
      id: OTRO,
    } as Usuario);
    const crear = spyOn(chatRepository, 'crear').mockResolvedValue(MENSAJE);
    // When: se envía un mensaje con espacios alrededor
    const resultado = await chatService.enviar(YO, OTRO, '  Hola  ');
    // Then: se guarda recortado y se devuelve el mensaje
    expect(crear).toHaveBeenCalledWith(YO, OTRO, 'Hola');
    expect(resultado).toBe(MENSAJE);
  });

  test('rechaza mensajes vacíos, a uno mismo o a un usuario inexistente', async () => {
    const buscar = spyOn(usuariosRepository, 'buscarPorId').mockResolvedValue(
      undefined
    );
    const crear = spyOn(chatRepository, 'crear');
    // Given / When / Then: un mensaje de solo espacios
    await expect(chatService.enviar(YO, OTRO, '   ')).rejects.toThrow(
      'no puede estar vacío'
    );
    // Given / When / Then: un mensaje a uno mismo
    await expect(chatService.enviar(YO, YO, 'Hola')).rejects.toThrow(
      'a ti mismo'
    );
    // Given / When / Then: un destinatario que no existe
    await expect(chatService.enviar(YO, OTRO, 'Hola')).rejects.toThrow(
      'Usuario no encontrado.'
    );
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(crear).not.toHaveBeenCalled();
  });

  test('conversacion delega en el repositorio', async () => {
    // Given: un repositorio con un mensaje
    const listar = spyOn(
      chatRepository,
      'listarConversacion'
    ).mockResolvedValue([MENSAJE]);
    // When: se pide la conversación
    // Then: devuelve los mensajes entre ambos usuarios
    expect(await chatService.conversacion(YO, OTRO)).toEqual([MENSAJE]);
    expect(listar).toHaveBeenCalledWith(YO, OTRO);
  });
});

describe('POST /api/chat/mensajes', () => {
  test('201 con el mensaje; el remitente sale de la sesión', async () => {
    // Given: una sesión válida y un servicio que guarda
    sesion();
    const enviar = spyOn(chatService, 'enviar').mockResolvedValue(MENSAJE);
    // When: se envía un mensaje
    const res = await pedido('/api/chat/mensajes', 'POST', {
      destinatarioId: OTRO,
      contenido: 'Hola',
    });
    // Then: responde 201 y el remitente es el de la sesión
    expect(res.status).toBe(201);
    expect(enviar).toHaveBeenCalledWith(YO, OTRO, 'Hola');
    expect(((await res.json()) as MensajeFila).id).toBe('m1');
  });

  test('400 con destinatario no uuid, mensaje vacío o demasiado largo', async () => {
    sesion();
    // Given / When / Then: cada cuerpo inválido responde 400
    for (const cuerpo of [
      { destinatarioId: 'no-uuid', contenido: 'Hola' },
      { destinatarioId: OTRO, contenido: '' },
      { destinatarioId: OTRO, contenido: 'x'.repeat(2001) },
      { destinatarioId: OTRO },
    ]) {
      expect((await pedido('/api/chat/mensajes', 'POST', cuerpo)).status).toBe(
        400
      );
    }
  });

  test('401 sin sesión válida', async () => {
    // Given: una sesión que no existe
    spyOn(authService, 'resolverUsuario').mockRejectedValue(
      new UnauthorizedError('Sesión inválida o expirada.')
    );
    // When: se intenta enviar
    const res = await pedido('/api/chat/mensajes', 'POST', {
      destinatarioId: OTRO,
      contenido: 'Hola',
    });
    // Then: responde 401
    expect(res.status).toBe(401);
  });
});

describe('GET /api/chat/conversacion/:id', () => {
  test('200 con los mensajes', async () => {
    // Given: una sesión válida y una conversación
    sesion();
    spyOn(chatService, 'conversacion').mockResolvedValue([MENSAJE]);
    // When: se pide la conversación con OTRO
    const res = await pedido(`/api/chat/conversacion/${OTRO}`, 'GET');
    // Then: responde 200 con la lista
    expect(res.status).toBe(200);
    expect(((await res.json()) as MensajeFila[])[0]?.contenido).toBe('Hola');
  });

  test('400 si el id no es uuid', async () => {
    // Given: una sesión válida
    sesion();
    // When: se pide con un id inválido
    const res = await pedido('/api/chat/conversacion/abc', 'GET');
    // Then: responde 400
    expect(res.status).toBe(400);
  });
});
