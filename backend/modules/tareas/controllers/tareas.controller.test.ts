/**
 * Pruebas HTTP del módulo `tareas` (US-006 y US-008) contra la app real con
 * `app.handle()`: sin puerto ni Postgres (sesión y servicio simulados).
 */
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';

process.env.DATABASE_URL ??= 'postgres://test';

import {
  UnauthorizedError,
  ValidationError,
} from '../../../shared/errors/app-error';
import { authService } from '../../auth/services/auth.service';
import type { Usuario } from '../../usuarios/entities/usuario.entity';
import type { TareaPublica } from '../mappers/tarea.mapper';
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
