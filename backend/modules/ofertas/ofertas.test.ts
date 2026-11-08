/**
 * Pruebas del módulo ofertas (US-011): servicio y endpoint HTTP. La app es
 * la real (`app.handle`); sesión y repositorios se simulan.
 */
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';

process.env.DATABASE_URL ??= 'postgres://test';

import { authService } from '../auth/services/auth.service';
import type { Tarea } from '../tareas/entities/tarea.entity';
import { tareasRepository } from '../tareas/repositories/tareas.repository';
import type { Usuario } from '../usuarios/entities/usuario.entity';
import type { Oferta } from './entities/oferta.entity';
import { ofertasRepository } from './repositories/ofertas.repository';
import {
  MENSAJE_NO_ACEPTA_OFERTAS,
  MENSAJE_YA_POSTULADO,
  ofertasService,
} from './services/ofertas.service';

const { buildApp } = await import('../../app');

const TAREA_ID = '33333333-3333-4333-8333-333333333333';
const FECHA = new Date('2026-02-01T00:00:00.000Z');
const AFILIADO = { id: 'u-afiliado', rol: 'afiliado' as const };
const CLIENTE = { id: 'u-cliente', rol: 'cliente' as const };

const OFERTA: Oferta = {
  id: 'o-1',
  tareaId: TAREA_ID,
  afiliadoId: AFILIADO.id,
  mensaje: 'Tengo experiencia',
  estado: 'pendiente',
  creadoEn: FECHA,
};

afterEach(() => {
  mock.restore();
});

/** Tarea de otra persona; `cambios` ajusta estado o autor. */
function tareaEncontrada(cambios: Partial<Tarea> = {}, yaPostulado = false) {
  return spyOn(tareasRepository, 'buscarPorId').mockResolvedValue({
    tarea: {
      id: TAREA_ID,
      usuarioId: 'u-autor',
      titulo: 'Arreglar grifo',
      descripcion: 'El grifo gotea día y noche, hay que repararlo pronto.',
      categoria: 'Plomería',
      estado: 'abierta',
      ubicacion: 'Belén',
      latitud: null,
      longitud: null,
      creadoEn: FECHA,
      actualizadoEn: FECHA,
      ...cambios,
    },
    autor: {
      id: 'u-autor',
      nombre: 'Ana',
      descripcion: null,
      ubicacion: null,
      fotoUrl: null,
    },
    yaPostulado,
  });
}

describe('ofertasService.enviar', () => {
  test('Esc 1-2: registra la oferta con el mensaje recortado', async () => {
    // Given: una tarea abierta ajena y un repositorio que inserta
    const buscar = tareaEncontrada();
    const crear = spyOn(ofertasRepository, 'crear').mockResolvedValue({
      tipo: 'creada',
      oferta: OFERTA,
    });
    // When: el afiliado se postula con un mensaje con espacios
    const resultado = await ofertasService.enviar(
      AFILIADO,
      TAREA_ID,
      '  Tengo experiencia  '
    );
    // Then: se guarda recortado, vinculado a la tarea y al afiliado
    expect(resultado).toBe(OFERTA);
    expect(buscar).toHaveBeenCalledWith(TAREA_ID, AFILIADO.id);
    expect(crear).toHaveBeenCalledWith({
      tareaId: TAREA_ID,
      afiliadoId: AFILIADO.id,
      mensaje: 'Tengo experiencia',
    });
  });

  test('el mensaje es opcional: vacío, blanco o ausente se guarda como null', async () => {
    tareaEncontrada();
    const crear = spyOn(ofertasRepository, 'crear').mockResolvedValue({
      tipo: 'creada',
      oferta: OFERTA,
    });
    // Given / When / Then: sin mensaje, null y solo espacios
    for (const mensaje of [undefined, null, '', '   ']) {
      await ofertasService.enviar(AFILIADO, TAREA_ID, mensaje);
      expect(crear).toHaveBeenLastCalledWith(
        expect.objectContaining({ mensaje: null })
      );
    }
  });

  test('Esc 4: un usuario con rol cliente no puede ofertar (403)', async () => {
    // Given: un repositorio que no debería tocarse
    const buscar = tareaEncontrada();
    // When / Then: falla con ForbiddenError antes de consultar nada
    await expect(
      ofertasService.enviar(CLIENTE, TAREA_ID, null)
    ).rejects.toThrow('Solo los afiliados');
    expect(buscar).not.toHaveBeenCalled();
  });

  test('no se puede ofertar en la propia tarea (403) ni en una inexistente (404)', async () => {
    // Given: una tarea publicada por el mismo afiliado
    tareaEncontrada({ usuarioId: AFILIADO.id });
    // When / Then: 403
    await expect(
      ofertasService.enviar(AFILIADO, TAREA_ID, null)
    ).rejects.toThrow('tu propia tarea');
    // Given: una tarea que no existe
    spyOn(tareasRepository, 'buscarPorId').mockResolvedValue(undefined);
    // When / Then: 404
    await expect(
      ofertasService.enviar(AFILIADO, TAREA_ID, null)
    ).rejects.toThrow('Tarea no encontrada.');
  });

  test('Esc 3: si ya se postuló, 409 con el mensaje de la historia', async () => {
    // Given: una tarea a la que el afiliado ya se postuló
    tareaEncontrada({}, true);
    const crear = spyOn(ofertasRepository, 'crear');
    // When / Then: ConflictError y no se escribe nada
    await expect(
      ofertasService.enviar(AFILIADO, TAREA_ID, null)
    ).rejects.toThrow(MENSAJE_YA_POSTULADO);
    expect(crear).not.toHaveBeenCalled();
  });

  test('Esc 5: una tarea ya asignada o cancelada rechaza la oferta (410)', async () => {
    const crear = spyOn(ofertasRepository, 'crear');
    // Given / When / Then: asignada y cancelada
    for (const estado of ['asignada', 'cancelada']) {
      tareaEncontrada({ estado });
      await expect(
        ofertasService.enviar(AFILIADO, TAREA_ID, null)
      ).rejects.toThrow(MENSAJE_NO_ACEPTA_OFERTAS);
    }
    expect(crear).not.toHaveBeenCalled();
  });

  test('Esc 3 y 5 en la inserción atómica: duplicada y no-abierta', async () => {
    // Given: una tarea que parecía abierta al leerla
    tareaEncontrada();
    const crear = spyOn(ofertasRepository, 'crear');
    // When: la inserción detecta una oferta concurrente del mismo afiliado
    crear.mockResolvedValue({ tipo: 'duplicada' });
    // Then: 409
    await expect(
      ofertasService.enviar(AFILIADO, TAREA_ID, null)
    ).rejects.toThrow(MENSAJE_YA_POSTULADO);
    // When: la inserción detecta que la tarea se cerró en ese instante
    crear.mockResolvedValue({ tipo: 'no-abierta' });
    // Then: 410
    await expect(
      ofertasService.enviar(AFILIADO, TAREA_ID, null)
    ).rejects.toThrow(MENSAJE_NO_ACEPTA_OFERTAS);
  });
});

describe('POST /api/tareas/:id/ofertas', () => {
  function pedido(ruta: string, cuerpo?: unknown) {
    return buildApp().handle(
      new Request(`http://localhost${ruta}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer tok',
        },
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      })
    );
  }

  function conSesion(usuario = AFILIADO) {
    spyOn(authService, 'resolverUsuario').mockResolvedValue(usuario as Usuario);
  }

  test('201 con la oferta; el afiliado sale de la sesión', async () => {
    // Given: una sesión de afiliado y un servicio que registra
    conSesion();
    const enviar = spyOn(ofertasService, 'enviar').mockResolvedValue(OFERTA);
    // When: se envía la oferta con mensaje
    const res = await pedido(`/api/tareas/${TAREA_ID}/ofertas`, {
      mensaje: 'Tengo experiencia',
    });
    // Then: responde 201 y el servicio recibe al afiliado de la sesión
    expect(res.status).toBe(201);
    expect(((await res.json()) as Oferta).id).toBe('o-1');
    expect(enviar).toHaveBeenCalledWith(
      expect.objectContaining({ id: AFILIADO.id }),
      TAREA_ID,
      'Tengo experiencia'
    );
  });

  test('acepta un cuerpo sin mensaje o con mensaje nulo', async () => {
    // Given: una sesión de afiliado
    conSesion();
    const enviar = spyOn(ofertasService, 'enviar').mockResolvedValue(OFERTA);
    // When: se envía {} y { mensaje: null }
    const a = await pedido(`/api/tareas/${TAREA_ID}/ofertas`, {});
    const b = await pedido(`/api/tareas/${TAREA_ID}/ofertas`, {
      mensaje: null,
    });
    // Then: ambas responden 201
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(enviar).toHaveBeenCalledTimes(2);
  });

  test('400 con un mensaje de más de 500 caracteres o un id que no es uuid', async () => {
    conSesion();
    // Given / When / Then: mensaje demasiado largo
    expect(
      (
        await pedido(`/api/tareas/${TAREA_ID}/ofertas`, {
          mensaje: 'x'.repeat(501),
        })
      ).status
    ).toBe(400);
    // Given / When / Then: id inválido
    expect((await pedido('/api/tareas/abc/ofertas', {})).status).toBe(400);
  });

  test('traduce 403, 404, 409 y 410 del servicio', async () => {
    conSesion();
    const enviar = spyOn(ofertasService, 'enviar');
    // Given / When / Then: cada error de dominio llega con su código
    const casos: Array<[Error, number]> = [
      [
        new (await import('../../shared/errors/app-error')).ForbiddenError(),
        403,
      ],
      [
        new (await import('../../shared/errors/app-error')).NotFoundError(),
        404,
      ],
      [
        new (await import('../../shared/errors/app-error')).ConflictError(),
        409,
      ],
      [new (await import('../../shared/errors/app-error')).GoneError(), 410],
    ];
    for (const [error, estado] of casos) {
      enviar.mockRejectedValue(error);
      expect((await pedido(`/api/tareas/${TAREA_ID}/ofertas`, {})).status).toBe(
        estado
      );
    }
  });

  test('401 sin sesión válida', async () => {
    // Given: una petición sin token
    // When: se intenta ofertar
    const res = await buildApp().handle(
      new Request(`http://localhost/api/tareas/${TAREA_ID}/ofertas`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
    );
    // Then: responde 401
    expect(res.status).toBe(401);
  });
});
