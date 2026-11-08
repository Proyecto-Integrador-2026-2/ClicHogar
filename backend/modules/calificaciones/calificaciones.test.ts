/**
 * Pruebas del módulo calificaciones (US-016): servicio y endpoints HTTP (app
 * real con `app.handle`; sesión y repositorios simulados).
 */
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';

process.env.DATABASE_URL ??= 'postgres://test';

import { authService } from '../auth/services/auth.service';
import type { Tarea, UsuarioContacto } from '../tareas/entities/tarea.entity';
import { tareasRepository } from '../tareas/repositories/tareas.repository';
import type { Usuario } from '../usuarios/entities/usuario.entity';
import {
  calificacionesRepository,
  type CalificacionFila,
} from './repositories/calificaciones.repository';
import {
  MENSAJE_SOLO_CREADOR_CALIFICA,
  MENSAJE_TAREA_NO_FINALIZADA,
  MENSAJE_YA_CALIFICADA,
  calificacionesService,
} from './services/calificaciones.service';

const { buildApp } = await import('../../app');

const AUTOR = { id: 'u-autor' };
const AFILIADO: UsuarioContacto = {
  id: 'u-afiliado',
  nombre: 'José',
  email: 'jose@ejemplo.com',
};
const TAREA_ID = '33333333-3333-4333-8333-333333333333';
const OTRO_ID = '22222222-2222-4222-8222-222222222222';

const FILA: CalificacionFila = {
  id: 'c1',
  tarea_id: TAREA_ID,
  autor_id: AUTOR.id,
  destinatario_id: AFILIADO.id,
  puntuacion: 5,
  comentario: null,
  creado_en: new Date('2026-01-01T00:00:00.000Z'),
};

afterEach(() => {
  mock.restore();
});

/** Tarea de `AUTOR`; `cambios` ajusta su estado o autor; `asignado` el afiliado. */
function tareaEncontrada(
  cambios: Partial<Tarea> = {},
  asignado: UsuarioContacto | null = AFILIADO
) {
  return spyOn(tareasRepository, 'buscarPorId').mockResolvedValue({
    tarea: {
      id: TAREA_ID,
      usuarioId: AUTOR.id,
      titulo: 'Arreglar grifo',
      descripcion:
        'El grifo de la cocina gotea día y noche, hay que repararlo.',
      categoria: 'Plomería',
      estado: 'finalizada',
      ubicacion: 'Belén',
      latitud: null,
      longitud: null,
      creadoEn: new Date('2026-02-01T00:00:00.000Z'),
      actualizadoEn: new Date('2026-02-01T00:00:00.000Z'),
      ...cambios,
    },
    autor: {
      id: AUTOR.id,
      nombre: 'Ana',
      descripcion: null,
      ubicacion: null,
      fotoUrl: null,
    },
    autorEmail: 'ana@ejemplo.com',
    yaPostulado: false,
    asignado,
  });
}

describe('calificacionesService.crear (US-016)', () => {
  test('Esc 1: califica con estrellas y reseña recortada, al afiliado de la tarea', async () => {
    // Given: una tarea finalizada del autor y un repositorio que inserta
    tareaEncontrada();
    const crear = spyOn(
      calificacionesRepository,
      'crearParaTarea'
    ).mockResolvedValue({ tipo: 'creada', calificacion: FILA });
    // When: califica con 5 estrellas y un comentario con espacios
    const resultado = await calificacionesService.crear(AUTOR, {
      tareaId: TAREA_ID,
      puntuacion: 5,
      comentario: '  Excelente trabajo  ',
    });
    // Then: se guarda recortado; el afiliado lo decide la tarea, no el cliente
    expect(resultado).toBe(FILA);
    expect(crear).toHaveBeenCalledWith({
      tareaId: TAREA_ID,
      autorId: AUTOR.id,
      puntuacion: 5,
      comentario: 'Excelente trabajo',
    });
  });

  test('Esc 2: la reseña es opcional (ausente, null o en blanco = sin reseña)', async () => {
    tareaEncontrada();
    const crear = spyOn(
      calificacionesRepository,
      'crearParaTarea'
    ).mockResolvedValue({ tipo: 'creada', calificacion: FILA });
    // Given / When / Then: sin comentario, null y solo espacios
    for (const comentario of [undefined, null, '', '   ']) {
      await calificacionesService.crear(AUTOR, {
        tareaId: TAREA_ID,
        puntuacion: 4,
        comentario,
      });
      expect(crear).toHaveBeenLastCalledWith(
        expect.objectContaining({ comentario: null })
      );
    }
  });

  test('solo el creador califica (403), la tarea existe (404) y debe estar finalizada (400)', async () => {
    const crear = spyOn(calificacionesRepository, 'crearParaTarea');
    // Given / When / Then: otra persona
    tareaEncontrada({ usuarioId: 'u-otro' });
    await expect(
      calificacionesService.crear(AUTOR, { tareaId: TAREA_ID, puntuacion: 5 })
    ).rejects.toThrow(MENSAJE_SOLO_CREADOR_CALIFICA);
    // Given / When / Then: tarea inexistente
    spyOn(tareasRepository, 'buscarPorId').mockResolvedValue(undefined);
    await expect(
      calificacionesService.crear(AUTOR, { tareaId: TAREA_ID, puntuacion: 5 })
    ).rejects.toThrow('Tarea no encontrada.');
    // Given / When / Then: abierta, asignada o finalizada sin afiliado
    for (const [estado, asignado] of [
      ['abierta', null],
      ['asignada', AFILIADO],
      ['finalizada', null],
    ] as const) {
      tareaEncontrada({ estado }, asignado);
      await expect(
        calificacionesService.crear(AUTOR, { tareaId: TAREA_ID, puntuacion: 5 })
      ).rejects.toThrow(MENSAJE_TAREA_NO_FINALIZADA);
    }
    expect(crear).not.toHaveBeenCalled();
  });

  test('Esc 5: una segunda calificación se rechaza con el mensaje de la historia', async () => {
    // Given: una tarea finalizada que el autor ya calificó (carrera en la escritura)
    tareaEncontrada();
    const crear = spyOn(calificacionesRepository, 'crearParaTarea');
    crear.mockResolvedValue({ tipo: 'duplicada' });
    // When / Then: 409 con el mensaje
    await expect(
      calificacionesService.crear(AUTOR, { tareaId: TAREA_ID, puntuacion: 5 })
    ).rejects.toThrow(MENSAJE_YA_CALIFICADA);
    // Given: y si la tarea dejó de ser elegible entre la lectura y la escritura
    crear.mockResolvedValue({ tipo: 'no-elegible' });
    // When / Then: 400
    await expect(
      calificacionesService.crear(AUTOR, { tareaId: TAREA_ID, puntuacion: 5 })
    ).rejects.toThrow(MENSAJE_TAREA_NO_FINALIZADA);
  });
});

describe('calificacionesService.formulario y listarPorUsuario (US-016)', () => {
  test('devuelve a quién se califica y si ya se hizo', async () => {
    // Given: una tarea finalizada sin calificar
    tareaEncontrada();
    const existe = spyOn(calificacionesRepository, 'existe').mockResolvedValue(
      false
    );
    // When: se pide el formulario
    const f = await calificacionesService.formulario(AUTOR, TAREA_ID);
    // Then: trae la tarea y el afiliado, sin calificar
    expect(f).toEqual({
      tareaId: TAREA_ID,
      titulo: 'Arreglar grifo',
      afiliado: { id: AFILIADO.id, nombre: 'José' },
      yaCalificada: false,
    });
    expect(existe).toHaveBeenCalledWith(TAREA_ID, AUTOR.id);
    // Given: ahora ya calificada
    existe.mockResolvedValue(true);
    // When / Then: yaCalificada
    expect(
      (await calificacionesService.formulario(AUTOR, TAREA_ID)).yaCalificada
    ).toBe(true);
  });

  test('exige ser el creador de una tarea finalizada', async () => {
    // Given: una tarea ajena
    tareaEncontrada({ usuarioId: 'u-otro' });
    // When / Then: 403
    await expect(
      calificacionesService.formulario(AUTOR, TAREA_ID)
    ).rejects.toThrow(MENSAJE_SOLO_CREADOR_CALIFICA);
    // Given: una tarea todavía asignada
    tareaEncontrada({ estado: 'asignada' });
    // When / Then: 400
    await expect(
      calificacionesService.formulario(AUTOR, TAREA_ID)
    ).rejects.toThrow(MENSAJE_TAREA_NO_FINALIZADA);
  });

  test('listarPorUsuario delega en el repositorio', async () => {
    // Given: un repositorio con una calificación
    const listar = spyOn(
      calificacionesRepository,
      'listarPorDestinatario'
    ).mockResolvedValue([FILA]);
    // When / Then: devuelve la lista
    expect(await calificacionesService.listarPorUsuario(OTRO_ID)).toEqual([
      FILA,
    ]);
    expect(listar).toHaveBeenCalledWith(OTRO_ID);
  });
});

describe('endpoints de calificaciones', () => {
  function pedido(ruta: string, metodo = 'GET', cuerpo?: unknown) {
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

  const conSesion = () =>
    spyOn(authService, 'resolverUsuario').mockResolvedValue(AUTOR as Usuario);

  test('POST 201; el autor sale de la sesión y el afiliado de la tarea', async () => {
    // Given: una sesión válida y un servicio que califica
    conSesion();
    const crear = spyOn(calificacionesService, 'crear').mockResolvedValue(FILA);
    // When: se califica con estrellas y reseña nula
    const res = await pedido('/api/calificaciones', 'POST', {
      tareaId: TAREA_ID,
      puntuacion: 5,
      comentario: null,
    });
    // Then: 201 y el servicio recibe al autor de la sesión (no hay destinatario en el body)
    expect(res.status).toBe(201);
    expect(crear).toHaveBeenCalledWith(
      expect.objectContaining({ id: AUTOR.id }),
      expect.objectContaining({ tareaId: TAREA_ID, puntuacion: 5 })
    );
  });

  test('POST acepta una calificación sin el campo de reseña', async () => {
    // Given: una sesión válida
    conSesion();
    spyOn(calificacionesService, 'crear').mockResolvedValue(FILA);
    // When: se califica sin comentario
    const res = await pedido('/api/calificaciones', 'POST', {
      tareaId: TAREA_ID,
      puntuacion: 3,
    });
    // Then: 201
    expect(res.status).toBe(201);
  });

  test('POST 400 con puntuación inválida, sin tarea, id no uuid o reseña de más de 500', async () => {
    conSesion();
    // Given / When / Then: cada cuerpo inválido responde 400
    for (const cuerpo of [
      { tareaId: TAREA_ID, puntuacion: 99 },
      { tareaId: TAREA_ID, puntuacion: 0 },
      { tareaId: TAREA_ID, puntuacion: 4.5 },
      { tareaId: TAREA_ID },
      { puntuacion: 5 },
      { tareaId: 'no-uuid', puntuacion: 5 },
      { tareaId: TAREA_ID, puntuacion: 5, comentario: 'x'.repeat(501) },
    ]) {
      expect((await pedido('/api/calificaciones', 'POST', cuerpo)).status).toBe(
        400
      );
    }
  });

  test('POST traduce 403, 409 y 400 del servicio; 401 sin sesión', async () => {
    conSesion();
    const crear = spyOn(calificacionesService, 'crear');
    const errores = await import('../../shared/errors/app-error');
    // Given / When / Then: cada error de dominio llega con su código
    const casos: Array<[Error, number]> = [
      [new errores.ForbiddenError(), 403],
      [new errores.ConflictError(MENSAJE_YA_CALIFICADA), 409],
      [new errores.ValidationError(), 400],
    ];
    for (const [error, estado] of casos) {
      crear.mockRejectedValue(error);
      expect(
        (
          await pedido('/api/calificaciones', 'POST', {
            tareaId: TAREA_ID,
            puntuacion: 5,
          })
        ).status
      ).toBe(estado);
    }
    // Given: sin cabecera Authorization
    mock.restore();
    // When / Then: 401
    const sin = await buildApp().handle(
      new Request('http://localhost/api/calificaciones', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tareaId: TAREA_ID, puntuacion: 5 }),
      })
    );
    expect(sin.status).toBe(401);
  });

  test('GET /tarea/:id devuelve el formulario; 400 con id inválido; 401 sin sesión', async () => {
    // Given: una sesión válida y un formulario
    conSesion();
    const formulario = spyOn(
      calificacionesService,
      'formulario'
    ).mockResolvedValue({
      tareaId: TAREA_ID,
      titulo: 'Arreglar grifo',
      afiliado: { id: AFILIADO.id, nombre: 'José' },
      yaCalificada: true,
    });
    // When: se pide el formulario de la tarea
    const res = await pedido(`/api/calificaciones/tarea/${TAREA_ID}`);
    // Then: 200 con el afiliado y yaCalificada
    expect(res.status).toBe(200);
    expect(((await res.json()) as { yaCalificada: boolean }).yaCalificada).toBe(
      true
    );
    expect(formulario).toHaveBeenCalledWith(
      expect.objectContaining({ id: AUTOR.id }),
      TAREA_ID
    );
    // When / Then: id inválido
    expect((await pedido('/api/calificaciones/tarea/abc')).status).toBe(400);
    // Given: sin cabecera Authorization
    mock.restore();
    // When / Then: 401
    const sin = await buildApp().handle(
      new Request(`http://localhost/api/calificaciones/tarea/${TAREA_ID}`)
    );
    expect(sin.status).toBe(401);
  });

  test('GET /usuario/:id es público; 400 si el id no es uuid', async () => {
    // Given: un servicio con una calificación
    spyOn(calificacionesService, 'listarPorUsuario').mockResolvedValue([FILA]);
    // When: se pide sin Authorization
    const res = await buildApp().handle(
      new Request(`http://localhost/api/calificaciones/usuario/${OTRO_ID}`)
    );
    // Then: 200 con la lista
    expect(res.status).toBe(200);
    expect(((await res.json()) as CalificacionFila[])[0]?.id).toBe('c1');
    // When / Then: id inválido
    expect((await pedido('/api/calificaciones/usuario/abc')).status).toBe(400);
  });
});
