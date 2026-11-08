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
import type { Oferta, OfertaRecibida } from './entities/oferta.entity';
import { ofertasRepository } from './repositories/ofertas.repository';
import {
  MENSAJE_NO_ACEPTA_OFERTAS,
  MENSAJE_SIN_PERMISO_OFERTAS,
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

const recibida = (
  id: string,
  promedio: number | null,
  total = promedio === null ? 0 : 1
): OfertaRecibida => ({
  id,
  mensaje: 'Tengo experiencia',
  estado: 'pendiente',
  creadoEn: FECHA,
  afiliado: {
    id: `a-${id}`,
    nombre: `Afiliado ${id}`,
    fotoUrl: null,
    descripcion: null,
    ubicacion: null,
    promedio,
    totalCalificaciones: total,
  },
});

describe('ofertasService.listarRecibidas (US-012)', () => {
  const AUTOR = { id: 'u-autor' };

  test('Esc 1 y 5: el creador ve las ofertas con el promedio a 1 decimal', async () => {
    // Given: el creador de la tarea y dos ofertas (una sin calificaciones)
    const buscar = tareaEncontrada();
    const listar = spyOn(ofertasRepository, 'listarPorTarea').mockResolvedValue(
      [recibida('o-1', 4.333333), recibida('o-2', null)]
    );
    // When: pide las ofertas recibidas
    const lista = await ofertasService.listarRecibidas(AUTOR, TAREA_ID);
    // Then: conserva el orden del repositorio y redondea el promedio a 1 decimal
    expect(lista.map((o) => o.id)).toEqual(['o-1', 'o-2']);
    expect(lista[0]?.afiliado.promedio).toBe(4.3);
    expect(lista[1]?.afiliado.promedio).toBeNull();
    expect(buscar).toHaveBeenCalledWith(TAREA_ID, AUTOR.id);
    expect(listar).toHaveBeenCalledWith(TAREA_ID);
  });

  test('Esc 3: sin ofertas devuelve una lista vacía', async () => {
    // Given: una tarea propia sin postulaciones
    tareaEncontrada();
    spyOn(ofertasRepository, 'listarPorTarea').mockResolvedValue([]);
    // When / Then: lista vacía
    expect(await ofertasService.listarRecibidas(AUTOR, TAREA_ID)).toEqual([]);
  });

  test('Esc 4: otro usuario o afiliado recibe 403 sin ver a los postulantes', async () => {
    // Given: una tarea de otra persona
    tareaEncontrada();
    const listar = spyOn(ofertasRepository, 'listarPorTarea');
    // When / Then: tanto un afiliado como un cliente reciben 403 con el mensaje
    for (const visitante of [AFILIADO, CLIENTE]) {
      await expect(
        ofertasService.listarRecibidas(visitante, TAREA_ID)
      ).rejects.toThrow(MENSAJE_SIN_PERMISO_OFERTAS);
    }
    // Then: nunca se consultaron las ofertas
    expect(listar).not.toHaveBeenCalled();
  });

  test('una tarea inexistente responde 404', async () => {
    // Given: un repositorio sin esa tarea
    spyOn(tareasRepository, 'buscarPorId').mockResolvedValue(undefined);
    // When / Then: NotFoundError
    await expect(
      ofertasService.listarRecibidas(AUTOR, TAREA_ID)
    ).rejects.toThrow('Tarea no encontrada.');
  });
});

describe('GET /api/tareas/:id/ofertas', () => {
  function pedir(ruta: string) {
    return buildApp().handle(
      new Request(`http://localhost${ruta}`, {
        headers: { authorization: 'Bearer tok' },
      })
    );
  }

  test('200 con las ofertas; el visitante sale de la sesión', async () => {
    // Given: una sesión válida y un servicio con una oferta
    spyOn(authService, 'resolverUsuario').mockResolvedValue({
      id: 'u-autor',
    } as Usuario);
    const listar = spyOn(ofertasService, 'listarRecibidas').mockResolvedValue([
      recibida('o-1', 5),
    ]);
    // When: se piden las ofertas
    const res = await pedir(`/api/tareas/${TAREA_ID}/ofertas`);
    // Then: responde 200 y el servicio recibe al visitante y la tarea
    expect(res.status).toBe(200);
    expect(((await res.json()) as OfertaRecibida[])[0]?.afiliado.promedio).toBe(
      5
    );
    expect(listar).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u-autor' }),
      TAREA_ID
    );
  });

  test('403 con el mensaje de permisos para quien no es el creador', async () => {
    // Given: una sesión de otra persona (el servicio real decide)
    spyOn(authService, 'resolverUsuario').mockResolvedValue(
      AFILIADO as Usuario
    );
    tareaEncontrada();
    // When: se piden las ofertas
    const res = await pedir(`/api/tareas/${TAREA_ID}/ofertas`);
    // Then: responde 403 con el mensaje de la historia y sin datos de postulantes
    expect(res.status).toBe(403);
    expect(((await res.json()) as { message: string }).message).toBe(
      MENSAJE_SIN_PERMISO_OFERTAS
    );
  });

  test('400 si el id no es uuid y 401 sin sesión', async () => {
    // Given: una sesión válida
    spyOn(authService, 'resolverUsuario').mockResolvedValue(
      AFILIADO as Usuario
    );
    // When / Then: id inválido
    expect((await pedir('/api/tareas/abc/ofertas')).status).toBe(400);
    // Given: sin cabecera Authorization
    mock.restore();
    // When / Then: 401
    const sin = await buildApp().handle(
      new Request(`http://localhost/api/tareas/${TAREA_ID}/ofertas`)
    );
    expect(sin.status).toBe(401);
  });
});
