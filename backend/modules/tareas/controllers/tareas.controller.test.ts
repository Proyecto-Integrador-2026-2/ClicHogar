/**
 * Pruebas HTTP del módulo `tareas` (US-006 y US-008) contra la app real con
 * `app.handle()`: sin puerto ni Postgres (sesión y servicio simulados).
 */
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';

process.env.DATABASE_URL ??= 'postgres://test';

import {
  ConflictError,
  ForbiddenError,
  GoneError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../../shared/errors/app-error';
import { authService } from '../../auth/services/auth.service';
import type { Usuario } from '../../usuarios/entities/usuario.entity';
import type { DetalleTarea, TareaPublica } from '../mappers/tarea.mapper';
import { tareasService, type PaginaTareas } from '../services/tareas.service';

const { buildApp } = await import('../../../app');

const TAREA: TareaPublica = {
  id: 't-1',
  titulo: 'Arreglar grifo',
  descripcion: 'El grifo de la cocina gotea día y noche, hay que repararlo.',
  categoria: 'Plomería',
  estado: 'abierta',
  ubicacion: 'Belén, Medellín',
  latitud: null,
  longitud: null,
  autorId: 'u-1',
  autorNombre: 'Ana',
  creadoEn: new Date('2026-02-01T00:00:00.000Z'),
};

const PAGINA: PaginaTareas = {
  tareas: [TAREA],
  pagina: 1,
  limite: 12,
  hayMas: false,
};

afterEach(() => {
  mock.restore();
});

function conSesion() {
  return spyOn(authService, 'resolverUsuario').mockResolvedValue({
    id: 'u-1',
  } as Usuario);
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

describe('POST /api/tareas', () => {
  const cuerpo = {
    titulo: 'Arreglar grifo',
    descripcion: 'El grifo de la cocina gotea día y noche, hay que repararlo.',
    categoria: 'Plomería',
    ubicacion: 'Belén, Medellín',
  };

  test('201 con la tarea; el autor sale de la sesión', async () => {
    // Given: una sesión válida y un servicio que publica
    conSesion();
    const crear = spyOn(tareasService, 'crearTarea').mockResolvedValue(TAREA);
    // When: se publica una tarea
    const res = await pedido('/api/tareas', 'POST', cuerpo);
    // Then: responde 201 y el servicio recibe el id de la sesión
    expect(res.status).toBe(201);
    expect(crear).toHaveBeenCalledWith('u-1', expect.objectContaining(cuerpo));
    expect(((await res.json()) as TareaPublica).id).toBe('t-1');
  });

  test('400 con una categoría fuera del vocabulario o campos faltantes', async () => {
    // Given: una sesión válida
    conSesion();
    // When / Then: cada cuerpo inválido responde 400
    for (const mal of [
      { ...cuerpo, categoria: 'Astrología' },
      { titulo: 'x' },
    ]) {
      expect((await pedido('/api/tareas', 'POST', mal)).status).toBe(400);
    }
  });

  test('401 sin sesión válida', async () => {
    // Given: una sesión que no existe
    spyOn(authService, 'resolverUsuario').mockRejectedValue(
      new UnauthorizedError('Sesión inválida o expirada.')
    );
    // When: se intenta publicar
    const res = await pedido('/api/tareas', 'POST', cuerpo);
    // Then: responde 401
    expect(res.status).toBe(401);
  });
});

describe('GET /api/tareas (tablero, US-008)', () => {
  test('200 con la página; sin query usa los valores por defecto', async () => {
    // Given: una sesión válida y un servicio con una página
    conSesion();
    const listar = spyOn(tareasService, 'listarAbiertas').mockResolvedValue(
      PAGINA
    );
    // When: se pide el tablero sin parámetros
    const res = await pedido('/api/tareas', 'GET');
    // Then: responde 200 con la página
    expect(res.status).toBe(200);
    const cuerpo = (await res.json()) as PaginaTareas;
    expect(cuerpo.tareas).toHaveLength(1);
    expect(cuerpo.hayMas).toBe(false);
    expect(listar).toHaveBeenCalledWith({});
  });

  test('convierte pagina, limite y cercanía a números', async () => {
    // Given: una sesión válida y un servicio con una página
    conSesion();
    const listar = spyOn(tareasService, 'listarAbiertas').mockResolvedValue(
      PAGINA
    );
    // When: se pide con paginación y cercanía en la query
    await pedido(
      '/api/tareas?pagina=2&limite=5&lat=6.2&lng=-75.5&radio=10',
      'GET'
    );
    // Then: el servicio las recibe como números
    expect(listar).toHaveBeenCalledWith({
      pagina: 2,
      limite: 5,
      lat: 6.2,
      lng: -75.5,
      radio: 10,
    });
  });

  test('400 si un parámetro no es numérico', async () => {
    // Given: una sesión válida
    conSesion();
    // When: se pide con pagina=abc
    const res = await pedido('/api/tareas?pagina=abc', 'GET');
    // Then: responde 400
    expect(res.status).toBe(400);
  });

  test('400 si el servicio rechaza el filtro (lat sin lng)', async () => {
    // Given: un servicio real que valida la cercanía (repositorio no usado)
    conSesion();
    // When: se pide solo con lat
    const res = await pedido('/api/tareas?lat=6.2', 'GET');
    // Then: responde 400 con el mensaje de validación
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message: string }).message).toContain(
      'cercanía'
    );
  });

  test('un error del servicio se traduce a su código', async () => {
    // Given: un servicio que rechaza por validación
    conSesion();
    spyOn(tareasService, 'listarAbiertas').mockRejectedValue(
      new ValidationError('Paginación inválida.')
    );
    // When: se pide el tablero
    const res = await pedido('/api/tareas?pagina=2', 'GET');
    // Then: responde 400
    expect(res.status).toBe(400);
  });

  test('401 sin sesión válida', async () => {
    // Given: una sesión que no existe
    spyOn(authService, 'resolverUsuario').mockRejectedValue(
      new UnauthorizedError('Sesión inválida o expirada.')
    );
    // When: se pide el tablero
    const res = await pedido('/api/tareas', 'GET');
    // Then: responde 401
    expect(res.status).toBe(401);
  });
});

describe('GET /api/tareas/:id (detalle, US-009)', () => {
  const ID = '33333333-3333-4333-8333-333333333333';
  const DETALLE: DetalleTarea = {
    ...TAREA,
    autor: {
      id: 'u-1',
      nombre: 'Ana',
      descripcion: null,
      ubicacion: null,
      fotoUrl: null,
    },
    esPropia: false,
    puedeOfertar: true,
    yaPostulado: false,
    esAsignado: false,
    puedeFinalizar: false,
    contacto: null,
    afiliadoAsignado: null,
  };

  test('200 con el detalle; el visitante sale de la sesión', async () => {
    // Given: una sesión válida y un servicio con el detalle
    conSesion();
    const obtener = spyOn(tareasService, 'obtenerDetalle').mockResolvedValue(
      DETALLE
    );
    // When: se pide el detalle
    const res = await pedido(`/api/tareas/${ID}`, 'GET');
    // Then: responde 200 y el servicio recibe al visitante y el id
    expect(res.status).toBe(200);
    expect(((await res.json()) as DetalleTarea).puedeOfertar).toBe(true);
    expect(obtener).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u-1' }),
      ID
    );
  });

  test('410 si la tarea ya no está disponible y 404 si no existe', async () => {
    // Given: una sesión válida y un servicio que detecta el cambio de estado
    conSesion();
    const obtener = spyOn(tareasService, 'obtenerDetalle').mockRejectedValue(
      new GoneError('Esta tarea ya no se encuentra disponible.')
    );
    // When: se pide el detalle
    const gone = await pedido(`/api/tareas/${ID}`, 'GET');
    // Then: responde 410 con el mensaje
    expect(gone.status).toBe(410);
    expect(((await gone.json()) as { message: string }).message).toContain(
      'ya no se encuentra disponible'
    );
    // Given: ahora una tarea inexistente
    obtener.mockRejectedValue(new NotFoundError('Tarea no encontrada.'));
    // When: se pide
    // Then: responde 404
    expect((await pedido(`/api/tareas/${ID}`, 'GET')).status).toBe(404);
  });

  test('400 si el id no es uuid', async () => {
    // Given: una sesión válida
    conSesion();
    // When: se pide con un id inválido
    const res = await pedido('/api/tareas/abc', 'GET');
    // Then: responde 400
    expect(res.status).toBe(400);
  });

  test('401 sin sesión válida', async () => {
    // Given: una sesión que no existe
    spyOn(authService, 'resolverUsuario').mockRejectedValue(
      new UnauthorizedError('Sesión inválida o expirada.')
    );
    // When: se pide el detalle
    const res = await pedido(`/api/tareas/${ID}`, 'GET');
    // Then: responde 401
    expect(res.status).toBe(401);
  });
});

describe('GET /api/tareas/mias (Mis solicitudes, US-012)', () => {
  test('200 con las tareas del usuario de la sesión', async () => {
    // Given: una sesión válida y un servicio con una tarea propia
    conSesion();
    const propias = spyOn(tareasService, 'listarPropias').mockResolvedValue([
      { ...TAREA, totalOfertas: 2 },
    ]);
    // When: se pide la lista
    const res = await pedido('/api/tareas/mias', 'GET');
    // Then: responde 200 con las tareas y el servicio recibe el id de la sesión
    expect(res.status).toBe(200);
    expect(
      ((await res.json()) as Array<{ totalOfertas: number }>)[0]?.totalOfertas
    ).toBe(2);
    expect(propias).toHaveBeenCalledWith('u-1');
  });

  test('401 sin sesión válida (y no se confunde con /:id)', async () => {
    // Given: una sesión que no existe
    spyOn(authService, 'resolverUsuario').mockRejectedValue(
      new UnauthorizedError('Sesión inválida o expirada.')
    );
    // When: se pide
    const res = await pedido('/api/tareas/mias', 'GET');
    // Then: responde 401
    expect(res.status).toBe(401);
  });
});

describe('POST /api/tareas/:id/asignar y /finalizar (US-013 y US-014)', () => {
  const ID = '33333333-3333-4333-8333-333333333333';
  const OFERTA = '44444444-4444-4444-8444-444444444444';

  test('asignar: 200 con la tarea asignada; el creador sale de la sesión', async () => {
    // Given: una sesión válida y un servicio que asigna
    conSesion();
    const asignar = spyOn(tareasService, 'asignar').mockResolvedValue({
      tareaId: ID,
      estado: 'asignada',
      afiliadoId: 'a-1',
    });
    // When: se elige una oferta
    const res = await pedido(`/api/tareas/${ID}/asignar`, 'POST', {
      ofertaId: OFERTA,
    });
    // Then: responde 200 y el servicio recibe al visitante, la tarea y la oferta
    expect(res.status).toBe(200);
    expect(((await res.json()) as { estado: string }).estado).toBe('asignada');
    expect(asignar).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u-1' }),
      ID,
      OFERTA
    );
  });

  test('asignar: traduce 403, 404 y 409 y valida el cuerpo', async () => {
    conSesion();
    const asignar = spyOn(tareasService, 'asignar');
    // Given / When / Then: cada error de dominio llega con su código
    const casos: Array<[Error, number]> = [
      [new ForbiddenError(), 403],
      [new NotFoundError(), 404],
      [new ConflictError('Esta tarea ya cuenta con un afiliado asignado'), 409],
    ];
    for (const [error, estado] of casos) {
      asignar.mockRejectedValue(error);
      expect(
        (
          await pedido(`/api/tareas/${ID}/asignar`, 'POST', {
            ofertaId: OFERTA,
          })
        ).status
      ).toBe(estado);
    }
    // Given / When / Then: cuerpo e id inválidos responden 400
    expect(
      (await pedido(`/api/tareas/${ID}/asignar`, 'POST', { ofertaId: 'abc' }))
        .status
    ).toBe(400);
    expect(
      (await pedido(`/api/tareas/abc/asignar`, 'POST', { ofertaId: OFERTA }))
        .status
    ).toBe(400);
  });

  test('finalizar: 200 con la tarea finalizada y el afiliado a calificar', async () => {
    // Given: una sesión válida y un servicio que finaliza
    conSesion();
    const finalizar = spyOn(tareasService, 'finalizar').mockResolvedValue({
      tareaId: ID,
      estado: 'finalizada',
      afiliadoId: 'a-1',
      finalizadaEn: new Date('2026-03-01T00:00:00.000Z'),
    });
    // When: se confirma el pago y se finaliza
    const res = await pedido(`/api/tareas/${ID}/finalizar`, 'POST', {
      pagoConfirmado: true,
    });
    // Then: responde 200 y el servicio recibe al visitante y el pago confirmado
    expect(res.status).toBe(200);
    expect(((await res.json()) as { afiliadoId: string }).afiliadoId).toBe(
      'a-1'
    );
    expect(finalizar).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u-1' }),
      ID,
      true
    );
  });

  test('finalizar: traduce 400, 403 y 409; valida el cuerpo; 401 sin sesión', async () => {
    conSesion();
    const finalizar = spyOn(tareasService, 'finalizar');
    // Given / When / Then: cada error de dominio llega con su código
    const casos: Array<[Error, number]> = [
      [new ValidationError(), 400],
      [new ForbiddenError(), 403],
      [new ConflictError(), 409],
    ];
    for (const [error, estado] of casos) {
      finalizar.mockRejectedValue(error);
      expect(
        (
          await pedido(`/api/tareas/${ID}/finalizar`, 'POST', {
            pagoConfirmado: true,
          })
        ).status
      ).toBe(estado);
    }
    // Given / When / Then: sin el campo o con otro tipo, 400
    expect(
      (await pedido(`/api/tareas/${ID}/finalizar`, 'POST', {})).status
    ).toBe(400);
    expect(
      (
        await pedido(`/api/tareas/${ID}/finalizar`, 'POST', {
          pagoConfirmado: 'si',
        })
      ).status
    ).toBe(400);
    // Given: una sesión que no existe
    mock.restore();
    spyOn(authService, 'resolverUsuario').mockRejectedValue(
      new UnauthorizedError('Sesión inválida o expirada.')
    );
    // When / Then: 401
    expect(
      (
        await pedido(`/api/tareas/${ID}/finalizar`, 'POST', {
          pagoConfirmado: true,
        })
      ).status
    ).toBe(401);
  });
});
