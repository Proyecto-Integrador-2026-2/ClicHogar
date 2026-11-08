/**
 * Pruebas del cliente HTTP del backend: `fetch` se simula, así que no hay
 * red. Cubre URL ausente, errores del backend (con y sin cuerpo), 401 como
 * sesión expirada y fallos de conexión.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  ErrorSesionExpirada,
  ErrorSinConexion,
  ErrorYaCalificada,
  obtenerFormularioCalificacion,
  ErrorTareaYaAsignada,
  asignarTarea,
  finalizarTarea,
  ErrorSinPermisoOfertas,
  listarMisTareas,
  listarOfertasRecibidas,
  obtenerDisponibilidadDe,
  obtenerPerfilPublico,
  ErrorTareaNoAceptaOfertas,
  ErrorYaPostulado,
  enviarOferta,
  ErrorTareaNoDisponible,
  actualizarPerfil,
  crearTarea,
  crearCalificacion,
  enviarMensaje,
  guardarDisponibilidad,
  iniciarSesion,
  listarConversacion,
  registrar,
  listarTareas,
  normalizarRolParaBackend,
  obtenerDisponibilidad,
  obtenerPerfil,
  obtenerReputacion,
  obtenerTarea,
  urlPublica,
} from './usuarios-api';

const fetchOriginal = globalThis.fetch;
const apiOriginal = process.env.PUBLIC_API_URL;

let ultima: { url: string; init?: RequestInit } | undefined;

function simular(respuesta: Response | Error) {
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    ultima = { url, init };
    if (respuesta instanceof Error) throw respuesta;
    return respuesta.clone();
  }) as unknown as typeof fetch;
}

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status });

beforeEach(() => {
  process.env.PUBLIC_API_URL = 'http://api.test';
  ultima = undefined;
});

afterEach(() => {
  globalThis.fetch = fetchOriginal;
  if (apiOriginal === undefined) delete process.env.PUBLIC_API_URL;
  else process.env.PUBLIC_API_URL = apiOriginal;
});

const SIN_URL = 'Falta PUBLIC_API_URL';
const SIN_RED = 'No hay conexión con el servidor';

describe('normalizarRolParaBackend', () => {
  test('Afiliado -> afiliado; cualquier otro -> cliente', () => {
    // Given: los textos ' Afiliado ' y 'Usuario'
    // When: se normalizan para el backend
    // Then: Afiliado pasa a 'afiliado' y cualquier otro a 'cliente'
    expect(normalizarRolParaBackend(' Afiliado ')).toBe('afiliado');
    expect(normalizarRolParaBackend('Usuario')).toBe('cliente');
  });
});

describe('urlPublica', () => {
  test('antepone la URL del API si existe', () => {
    // Given: PUBLIC_API_URL configurada en http://api.test
    // When: se arma la URL pública
    // Then: antepone la URL del API
    expect(urlPublica('/uploads/a.jpg')).toBe('http://api.test/uploads/a.jpg');
  });

  test('sin URL devuelve la ruta tal cual', () => {
    // Given: PUBLIC_API_URL vacía
    process.env.PUBLIC_API_URL = '';
    // When: se arma la URL pública
    // Then: devuelve la ruta tal cual
    expect(urlPublica('/uploads/a.jpg')).toBe('/uploads/a.jpg');
  });
});

describe('registrar e iniciarSesion', () => {
  const respuesta = { token: 'tok', usuario: { id: 'u1', rol: 'cliente' } };

  test('registrar envía el rol normalizado y no manda Authorization', async () => {
    // Given: un backend que responde con token y usuario
    simular(json(respuesta, 201));
    // When: se registra una cuenta con rol 'Afiliado'
    const resultado = await registrar({
      nombre: 'Ana',
      email: 'ana@ejemplo.com',
      password: 'Clave-1234',
      rol: 'Afiliado',
    });
    // Then: llama a /api/auth/register con rol 'afiliado' y sin token
    expect(resultado).toEqual(respuesta as never);
    expect(ultima?.url).toBe('http://api.test/api/auth/register');
    expect(JSON.parse(String(ultima?.init?.body))).toMatchObject({
      rol: 'afiliado',
      email: 'ana@ejemplo.com',
    });
    expect(
      (ultima?.init?.headers as Record<string, string>).Authorization
    ).toBeUndefined();
  });

  test('iniciarSesion envía correo y contraseña', async () => {
    // Given: un backend que responde con token y usuario
    simular(json(respuesta));
    // When: se inicia sesión
    await iniciarSesion({ email: 'ana@ejemplo.com', password: 'Clave-1234' });
    // Then: llama a /api/auth/login con las credenciales
    expect(ultima?.url).toBe('http://api.test/api/auth/login');
    expect(JSON.parse(String(ultima?.init?.body))).toEqual({
      email: 'ana@ejemplo.com',
      password: 'Clave-1234',
    });
  });

  test('errores: mensaje del backend, genérico, sin red y sin URL', async () => {
    const args = { email: 'a@b.co', password: 'x' };
    // Given: un backend que rechaza las credenciales con mensaje
    simular(json({ message: 'Credenciales inválidas.' }, 401));
    // When: se inicia sesión
    // Then: falla con el mensaje del backend (un 401 aquí no es sesión expirada)
    await expect(iniciarSesion(args)).rejects.toThrow(
      'Credenciales inválidas.'
    );
    // Given: un error 500 sin cuerpo JSON
    simular(new Response('x', { status: 500 }));
    // Then: falla con el mensaje genérico
    await expect(iniciarSesion(args)).rejects.toThrow('respondió 500');
    // Given: un fallo de red
    simular(new Error('offline'));
    // Then: propaga el error original
    await expect(iniciarSesion(args)).rejects.toThrow('offline');
    // Given: PUBLIC_API_URL vacía
    process.env.PUBLIC_API_URL = '';
    // Then: pide configurar PUBLIC_API_URL
    await expect(iniciarSesion(args)).rejects.toThrow(SIN_URL);
  });
});

describe('obtenerReputacion (lectura sin token, US-017)', () => {
  const reputacion = {
    promedio: 4.7,
    total: 3,
    valoraciones: [{ id: 'v1', puntuacion: 5 }],
  };

  test('llama a la ruta del usuario sin Authorization y devuelve la reputación', async () => {
    // Given: un backend que responde con la reputación
    simular(json(reputacion));
    // When: se pide la reputación (el id se codifica)
    const r = await obtenerReputacion('u 9');
    // Then: llama a /api/calificaciones/usuario/:id sin token
    expect(r).toEqual(reputacion as never);
    expect(ultima?.url).toBe(
      'http://api.test/api/calificaciones/usuario/u%209'
    );
    expect(ultima?.init?.headers).toBeUndefined();
  });

  test('un error del backend llega con su mensaje; sin red avisa', async () => {
    // Given: un backend que responde 400 con mensaje
    simular(json({ message: 'Id inválido.' }, 400));
    // When / Then: falla con ese mensaje
    await expect(obtenerReputacion('x')).rejects.toThrow('Id inválido.');
    // Given: un fallo de red
    simular(new Error('offline'));
    // When / Then: mensaje de falta de conexión
    await expect(obtenerReputacion('x')).rejects.toThrow(SIN_RED);
  });
});

describe('obtenerTarea (US-009)', () => {
  const detalle = {
    id: 't1',
    titulo: 'Arreglar grifo',
    esPropia: false,
    puedeOfertar: true,
    autor: { id: 'u1', nombre: 'Ana' },
  };

  test('devuelve el detalle y llama a la ruta con el token', async () => {
    // Given: un backend que responde con el detalle
    simular(json(detalle));
    // When: se pide la tarea (el id se codifica en la URL)
    const resultado = await obtenerTarea('tk', 't 1');
    // Then: llama a /api/tareas/:id con Bearer, con timeout, y devuelve el detalle
    expect(resultado).toEqual(detalle as never);
    expect(ultima?.url).toBe('http://api.test/api/tareas/t%201');
    expect(
      (ultima?.init?.headers as Record<string, string>).Authorization
    ).toBe('Bearer tk');
    expect(ultima?.init?.signal).toBeInstanceOf(AbortSignal);
  });

  test('404 y 410 son "tarea no disponible"', async () => {
    // Given: un backend que dice que la tarea no existe (404)
    simular(json({ message: 'Tarea no encontrada.' }, 404));
    // When / Then: falla con ErrorTareaNoDisponible
    await expect(obtenerTarea('tk', 't1')).rejects.toBeInstanceOf(
      ErrorTareaNoDisponible
    );
    // Given: un backend que dice que ya no está abierta (410)
    simular(
      json({ message: 'Esta tarea ya no se encuentra disponible.' }, 410)
    );
    // When / Then: mismo error, con el mensaje de la historia
    await expect(obtenerTarea('tk', 't1')).rejects.toThrow(
      'Lo sentimos, esta tarea ya no se encuentra disponible'
    );
  });

  test('401 es sesión expirada, otros fallos conservan su mensaje y sin red avisa', async () => {
    // Given: un 401
    simular(json({}, 401));
    // When / Then: sesión expirada
    await expect(obtenerTarea('tk', 't1')).rejects.toBeInstanceOf(
      ErrorSesionExpirada
    );
    // Given: un 500 con mensaje
    simular(json({ message: 'Caído' }, 500));
    // When / Then: propaga el mensaje del backend
    await expect(obtenerTarea('tk', 't1')).rejects.toThrow('Caído');
    // Given: un fallo de red
    simular(new Error('offline'));
    // When / Then: mensaje de falta de conexión
    await expect(obtenerTarea('tk', 't1')).rejects.toThrow(SIN_RED);
  });
});

describe('enviarOferta (US-011)', () => {
  test('hace POST a /ofertas con el mensaje recortado y Bearer', async () => {
    // Given: un backend que registra la oferta
    simular(json({ id: 'o1', estado: 'pendiente' }, 201));
    // When: se envía con un mensaje con espacios
    const oferta = await enviarOferta('tk', 't 1', '  Tengo experiencia  ');
    // Then: llama a la ruta con el id codificado, el cuerpo y el token
    expect(oferta.id).toBe('o1');
    expect(ultima?.url).toBe('http://api.test/api/tareas/t%201/ofertas');
    expect(ultima?.init?.method).toBe('POST');
    expect(JSON.parse(String(ultima?.init?.body))).toEqual({
      mensaje: 'Tengo experiencia',
    });
    expect(
      (ultima?.init?.headers as Record<string, string>).Authorization
    ).toBe('Bearer tk');
    expect(ultima?.init?.signal).toBeInstanceOf(AbortSignal);
  });

  test('sin mensaje o en blanco envía null', async () => {
    // Given: un backend que registra la oferta
    simular(json({ id: 'o1' }, 201));
    // When: se envía sin mensaje y con solo espacios
    await enviarOferta('tk', 't1');
    // Then: viaja null
    expect(JSON.parse(String(ultima?.init?.body))).toEqual({ mensaje: null });
    await enviarOferta('tk', 't1', '   ');
    expect(JSON.parse(String(ultima?.init?.body))).toEqual({ mensaje: null });
  });

  test('409 es ya postulado; 404 y 410, la tarea no acepta ofertas', async () => {
    // Given: un 409
    simular(json({ message: 'Ya te has postulado a esta tarea.' }, 409));
    // When / Then: ErrorYaPostulado
    await expect(enviarOferta('tk', 't1')).rejects.toBeInstanceOf(
      ErrorYaPostulado
    );
    // Given: un 410 y un 404
    for (const estado of [410, 404]) {
      simular(json({ message: 'x' }, estado));
      // When / Then: ErrorTareaNoAceptaOfertas con el mensaje de la historia
      await expect(enviarOferta('tk', 't1')).rejects.toBeInstanceOf(
        ErrorTareaNoAceptaOfertas
      );
    }
    await expect(enviarOferta('tk', 't1')).rejects.toThrow(
      'Lo sentimos, esta tarea ya no acepta nuevas ofertas en este momento'
    );
  });

  test('401, 403 y fallos de red tienen su propio tratamiento', async () => {
    // Given: un 401
    simular(json({}, 401));
    // When / Then: sesión expirada
    await expect(enviarOferta('tk', 't1')).rejects.toBeInstanceOf(
      ErrorSesionExpirada
    );
    // Given: un 403 con mensaje
    simular(
      json({ message: 'Solo los afiliados pueden enviar ofertas.' }, 403)
    );
    // When / Then: llega el mensaje del backend
    await expect(enviarOferta('tk', 't1')).rejects.toThrow(
      'Solo los afiliados'
    );
    // Given: un fallo de red
    simular(new Error('offline'));
    // When / Then: mensaje de falta de conexión
    await expect(enviarOferta('tk', 't1')).rejects.toThrow(SIN_RED);
  });
});

describe('listarOfertasRecibidas (US-012)', () => {
  test('llama a /ofertas con el token y devuelve la lista', async () => {
    // Given: un backend que responde con una oferta
    simular(json([{ id: 'o1' }]));
    // When: se piden las ofertas (el id se codifica)
    const lista = await listarOfertasRecibidas('tk', 't 1');
    // Then: llama a la ruta con Bearer y timeout
    expect(lista).toEqual([{ id: 'o1' } as never]);
    expect(ultima?.url).toBe('http://api.test/api/tareas/t%201/ofertas');
    expect(
      (ultima?.init?.headers as Record<string, string>).Authorization
    ).toBe('Bearer tk');
    expect(ultima?.init?.signal).toBeInstanceOf(AbortSignal);
  });

  test('403 es sin permiso, 404 tarea no disponible, 401 sesión expirada', async () => {
    // Given / When / Then: un 403
    simular(json({ message: 'No tienes los permisos' }, 403));
    await expect(listarOfertasRecibidas('tk', 't1')).rejects.toBeInstanceOf(
      ErrorSinPermisoOfertas
    );
    await expect(listarOfertasRecibidas('tk', 't1')).rejects.toThrow(
      'No tienes los permisos necesarios para ver las ofertas de esta tarea'
    );
    // Given / When / Then: un 404
    simular(json({}, 404));
    await expect(listarOfertasRecibidas('tk', 't1')).rejects.toBeInstanceOf(
      ErrorTareaNoDisponible
    );
    // Given / When / Then: un 401
    simular(json({}, 401));
    await expect(listarOfertasRecibidas('tk', 't1')).rejects.toBeInstanceOf(
      ErrorSesionExpirada
    );
  });
});

describe('listarMisTareas, obtenerPerfilPublico y obtenerDisponibilidadDe (US-012)', () => {
  test('listarMisTareas pide /tareas/mias con el token', async () => {
    // Given: un backend con una tarea propia
    simular(json([{ id: 't1', totalOfertas: 2 }]));
    // When: se piden mis solicitudes
    const lista = await listarMisTareas('tk');
    // Then: llama a la ruta con Bearer
    expect(lista[0]?.totalOfertas).toBe(2);
    expect(ultima?.url).toBe('http://api.test/api/tareas/mias');
    expect(
      (ultima?.init?.headers as Record<string, string>).Authorization
    ).toBe('Bearer tk');
  });

  test('obtenerPerfilPublico no manda token y avisa si no hay red', async () => {
    // Given: un backend con un perfil
    simular(json({ id: 'u9', nombre: 'José' }));
    // When: se lee el perfil público (id codificado)
    expect((await obtenerPerfilPublico('u 9')).id).toBe('u9');
    // Then: llama a /api/usuarios/:id sin Authorization
    expect(ultima?.url).toBe('http://api.test/api/usuarios/u%209');
    expect(ultima?.init?.headers).toBeUndefined();
    // Given: un fallo de red
    simular(new Error('offline'));
    // When / Then: mensaje de falta de conexión
    await expect(obtenerPerfilPublico('u9')).rejects.toThrow(SIN_RED);
  });

  test('obtenerDisponibilidadDe pide la matriz de otro usuario con el token', async () => {
    // Given: un backend con una franja
    simular(json([{ diaSemana: 1, franjaHoraria: 'tarde' }]));
    // When: se pide la disponibilidad de u9
    const slots = await obtenerDisponibilidadDe('tk', 'u9');
    // Then: llama a /api/usuarios/:id/disponibilidad con Bearer
    expect(slots).toEqual([{ diaSemana: 1, franjaHoraria: 'tarde' }]);
    expect(ultima?.url).toBe('http://api.test/api/usuarios/u9/disponibilidad');
    expect(
      (ultima?.init?.headers as Record<string, string>).Authorization
    ).toBe('Bearer tk');
  });
});

describe('asignarTarea y finalizarTarea (US-013 y US-014)', () => {
  test('asignarTarea hace POST /asignar con la oferta elegida y Bearer', async () => {
    // Given: un backend que asigna
    simular(json({ tareaId: 't1', estado: 'asignada', afiliadoId: 'a1' }));
    // When: se elige una oferta (el id de la tarea se codifica)
    const r = await asignarTarea('tk', 't 1', 'o1');
    // Then: llama a la ruta con el cuerpo, el token y timeout
    expect(r.afiliadoId).toBe('a1');
    expect(ultima?.url).toBe('http://api.test/api/tareas/t%201/asignar');
    expect(ultima?.init?.method).toBe('POST');
    expect(JSON.parse(String(ultima?.init?.body))).toEqual({ ofertaId: 'o1' });
    expect(
      (ultima?.init?.headers as Record<string, string>).Authorization
    ).toBe('Bearer tk');
    expect(ultima?.init?.signal).toBeInstanceOf(AbortSignal);
  });

  test('asignarTarea: 409 es ya asignada, 401 sesión expirada, otros mantienen su mensaje', async () => {
    // Given: un 409
    simular(json({ message: 'x' }, 409));
    // When / Then: ErrorTareaYaAsignada con el mensaje de la historia
    await expect(asignarTarea('tk', 't1', 'o1')).rejects.toBeInstanceOf(
      ErrorTareaYaAsignada
    );
    await expect(asignarTarea('tk', 't1', 'o1')).rejects.toThrow(
      'Esta tarea ya cuenta con un afiliado asignado'
    );
    // Given / When / Then: un 401
    simular(json({}, 401));
    await expect(asignarTarea('tk', 't1', 'o1')).rejects.toBeInstanceOf(
      ErrorSesionExpirada
    );
    // Given / When / Then: un 403 con mensaje
    simular(json({ message: 'Solo el creador' }, 403));
    await expect(asignarTarea('tk', 't1', 'o1')).rejects.toThrow(
      'Solo el creador'
    );
  });

  test('finalizarTarea hace POST /finalizar confirmando el pago', async () => {
    // Given: un backend que finaliza
    simular(
      json({
        tareaId: 't1',
        estado: 'finalizada',
        afiliadoId: 'a1',
        finalizadaEn: '2026-03-01T00:00:00.000Z',
      })
    );
    // When: se finaliza
    const r = await finalizarTarea('tk', 't1');
    // Then: llama a la ruta con pagoConfirmado y el token
    expect(r.estado).toBe('finalizada');
    expect(ultima?.url).toBe('http://api.test/api/tareas/t1/finalizar');
    expect(JSON.parse(String(ultima?.init?.body))).toEqual({
      pagoConfirmado: true,
    });
    expect(
      (ultima?.init?.headers as Record<string, string>).Authorization
    ).toBe('Bearer tk');
  });

  test('un fallo de red llega como ErrorSinConexion (distinguible de un rechazo del backend)', async () => {
    // Given: un fallo de red
    simular(new Error('offline'));
    // When / Then: ErrorSinConexion con el mensaje de falta de conexión
    await expect(finalizarTarea('tk', 't1')).rejects.toBeInstanceOf(
      ErrorSinConexion
    );
    await expect(asignarTarea('tk', 't1', 'o1')).rejects.toThrow(SIN_RED);
    // Given: un rechazo del backend
    simular(json({ message: 'No asignada' }, 409));
    // When / Then: error normal con su mensaje, no ErrorSinConexion
    const error = await finalizarTarea('tk', 't1').catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ErrorSinConexion);
    expect(error.message).toBe('No asignada');
  });
});

describe('chat y calificaciones (con token)', () => {
  test('enviarMensaje y listarConversacion usan el token', async () => {
    // Given: un backend que responde con un mensaje
    simular(json({ id: 'm1' }, 201));
    // When: se envía un mensaje
    await enviarMensaje({
      token: 'tk',
      destinatarioId: 'u2',
      contenido: 'Hola',
    });
    // Then: hace POST /api/chat/mensajes con Bearer y el cuerpo esperado
    expect(ultima?.url).toBe('http://api.test/api/chat/mensajes');
    expect(ultima?.init?.method).toBe('POST');
    expect(
      (ultima?.init?.headers as Record<string, string>).Authorization
    ).toBe('Bearer tk');
    expect(JSON.parse(String(ultima?.init?.body))).toEqual({
      destinatarioId: 'u2',
      contenido: 'Hola',
    });
    // Given: un backend que responde con la conversación
    simular(json([{ id: 'm1' }]));
    // When: se lista la conversación
    expect(await listarConversacion({ token: 'tk', usuarioId: 'u2' })).toEqual([
      { id: 'm1' } as never,
    ]);
    // Then: llama a /api/chat/conversacion/:id
    expect(ultima?.url).toBe('http://api.test/api/chat/conversacion/u2');
  });

  test('crearCalificacion envía la tarea, las estrellas y la reseña recortada', async () => {
    // Given: un backend que registra la calificación
    simular(json({ id: 'c1' }, 201));
    // When: se califica con una reseña con espacios
    await crearCalificacion({
      token: 'tk',
      tareaId: 't1',
      puntuacion: 4,
      comentario: '  Bien  ',
    });
    // Then: no viaja el afiliado (lo decide la tarea), con Bearer y timeout
    expect(ultima?.url).toBe('http://api.test/api/calificaciones');
    expect(JSON.parse(String(ultima?.init?.body))).toEqual({
      tareaId: 't1',
      puntuacion: 4,
      comentario: 'Bien',
    });
    expect(
      (ultima?.init?.headers as Record<string, string>).Authorization
    ).toBe('Bearer tk');
    expect(ultima?.init?.signal).toBeInstanceOf(AbortSignal);
  });

  test('la reseña es opcional: ausente o en blanco viaja como null', async () => {
    // Given: un backend que registra la calificación
    simular(json({ id: 'c1' }, 201));
    // When: se califica sin reseña y con solo espacios
    await crearCalificacion({ token: 'tk', tareaId: 't1', puntuacion: 5 });
    expect(JSON.parse(String(ultima?.init?.body)).comentario).toBeNull();
    await crearCalificacion({
      token: 'tk',
      tareaId: 't1',
      puntuacion: 5,
      comentario: '   ',
    });
    // Then: null en ambos
    expect(JSON.parse(String(ultima?.init?.body)).comentario).toBeNull();
  });

  test('409 es ya calificada; otros fallos conservan su mensaje', async () => {
    // Given: un 409
    simular(json({ message: 'x' }, 409));
    // When / Then: ErrorYaCalificada con el mensaje de la historia
    await expect(
      crearCalificacion({ token: 'tk', tareaId: 't1', puntuacion: 5 })
    ).rejects.toBeInstanceOf(ErrorYaCalificada);
    await expect(
      crearCalificacion({ token: 'tk', tareaId: 't1', puntuacion: 5 })
    ).rejects.toThrow(
      'Ya has enviado tu valoración para esta tarea anteriormente.'
    );
    // Given / When / Then: un 400 con mensaje y un fallo de red
    simular(
      json({ message: 'Solo puedes calificar una tarea finalizada' }, 400)
    );
    await expect(
      crearCalificacion({ token: 'tk', tareaId: 't1', puntuacion: 5 })
    ).rejects.toThrow('Solo puedes calificar');
    simular(new Error('offline'));
    await expect(
      crearCalificacion({ token: 'tk', tareaId: 't1', puntuacion: 5 })
    ).rejects.toBeInstanceOf(ErrorSinConexion);
  });

  test('obtenerFormularioCalificacion pide /calificaciones/tarea/:id con el token', async () => {
    // Given: un backend con el formulario
    simular(
      json({
        tareaId: 't1',
        titulo: 'Arreglar grifo',
        afiliado: { id: 'a1', nombre: 'José' },
        yaCalificada: false,
      })
    );
    // When: se pide (el id se codifica)
    const f = await obtenerFormularioCalificacion('tk', 't 1');
    // Then: llama a la ruta con Bearer y devuelve a quién se califica
    expect(f.afiliado.nombre).toBe('José');
    expect(ultima?.url).toBe('http://api.test/api/calificaciones/tarea/t%201');
    expect(
      (ultima?.init?.headers as Record<string, string>).Authorization
    ).toBe('Bearer tk');
    // Given / When / Then: un 401 es sesión expirada
    simular(json({}, 401));
    await expect(
      obtenerFormularioCalificacion('tk', 't1')
    ).rejects.toBeInstanceOf(ErrorSesionExpirada);
  });
});

describe('obtenerPerfil', () => {
  test('lee el perfil con el token', async () => {
    // Given: un backend que responde con el perfil
    simular(json({ id: 'u1' }));
    // When: se lee el perfil con el token
    expect((await obtenerPerfil('t')).id).toBe('u1');
    // Then: llama a /api/usuarios/yo y devuelve el perfil
    expect(ultima?.url).toBe('http://api.test/api/usuarios/yo');
  });

  test('errores del backend y URL ausente', async () => {
    // Given: un backend que responde 401
    simular(json({}, 401));
    // When: se lee el perfil
    // Then: falla con sesión expirada
    await expect(obtenerPerfil('t')).rejects.toBeInstanceOf(
      ErrorSesionExpirada
    );
    // Given: un backend que responde 500 sin JSON
    simular(new Response('x', { status: 500 }));
    // When: se lee el perfil
    // Then: falla con el mensaje genérico
    await expect(obtenerPerfil('t')).rejects.toThrow('respondió 500');
    // Given: PUBLIC_API_URL vacía
    process.env.PUBLIC_API_URL = '';
    // When: se lee el perfil
    // Then: falla pidiendo configurar PUBLIC_API_URL
    await expect(obtenerPerfil('t')).rejects.toThrow(SIN_URL);
  });
});

describe('actualizarPerfil', () => {
  test('solo envía los campos presentes (multipart)', async () => {
    simular(json({ id: 'u1' }));
    // Given: un archivo y textos de descripción y ubicación
    const foto = new File([new Uint8Array([1])], 'f.png', {
      type: 'image/png',
    });
    // When: se actualiza el perfil con todos los campos
    await actualizarPerfil({
      token: 't',
      foto,
      descripcion: 'Hola',
      ubicacion: 'Envigado',
    });
    const forma = ultima?.init?.body as FormData;
    expect(ultima?.init?.method).toBe('PATCH');
    // Then: viaja un multipart PATCH con todos los campos
    expect(forma.get('descripcion')).toBe('Hola');
    expect(forma.get('ubicacion')).toBe('Envigado');
    expect(forma.get('foto')).toBeInstanceOf(File);

    // When: se actualiza sin ningún campo
    await actualizarPerfil({ token: 't' });
    const vacia = ultima?.init?.body as FormData;
    // Then: el cuerpo no lleva ningún campo
    expect([...vacia.keys()]).toEqual([]);
  });

  test('errores del backend y URL ausente', async () => {
    // Given: un backend que responde 400 con mensaje
    simular(json({ message: 'Foto muy pesada' }, 400));
    // When: se actualiza el perfil
    // Then: falla con ese mensaje
    await expect(actualizarPerfil({ token: 't' })).rejects.toThrow(
      'Foto muy pesada'
    );
    // Given: un backend que responde 500 sin JSON
    simular(new Response('x', { status: 500 }));
    // When: se actualiza el perfil
    // Then: falla con el mensaje genérico
    await expect(actualizarPerfil({ token: 't' })).rejects.toThrow(
      'respondió 500'
    );
    // Given: PUBLIC_API_URL vacía
    process.env.PUBLIC_API_URL = '';
    // When: se actualiza el perfil
    // Then: falla pidiendo configurar PUBLIC_API_URL
    await expect(actualizarPerfil({ token: 't' })).rejects.toThrow(SIN_URL);
  });
});

describe('listarTareas', () => {
  test('devuelve la página del tablero', async () => {
    // Given: un backend que responde con una página con una tarea
    const pagina = {
      tareas: [{ id: 't1' }],
      pagina: 1,
      limite: 12,
      hayMas: false,
    };
    simular(json(pagina));
    // When: se lista el tablero
    // Then: devuelve esa página
    expect(await listarTareas('t')).toEqual(pagina as never);
    expect(ultima?.url).toBe('http://api.test/api/tareas');
  });

  test('envía paginación y cercanía en la query y un timeout', async () => {
    // Given: un backend que responde con una página vacía
    simular(json({ tareas: [], pagina: 2, limite: 5, hayMas: false }));
    // When: se pide la página 2 con filtro de cercanía
    await listarTareas('t', {
      pagina: 2,
      limite: 5,
      lat: 6.2,
      lng: -75.5,
      radio: 10,
    });
    // Then: la query lleva todos los parámetros y la petición puede abortarse
    const url = new URL(ultima!.url);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      pagina: '2',
      limite: '5',
      lat: '6.2',
      lng: '-75.5',
      radio: '10',
    });
    expect(ultima?.init?.signal).toBeInstanceOf(AbortSignal);
  });

  test('401 -> sesión expirada; otros errores con mensaje', async () => {
    // Given: un backend que responde 401
    simular(json({}, 401));
    // When: se lista el tablero
    // Then: falla con ErrorSesionExpirada
    await expect(listarTareas('t')).rejects.toBeInstanceOf(ErrorSesionExpirada);
    // Given: un backend que responde 503 con mensaje
    simular(json({ message: 'Caído' }, 503));
    // When: se lista el tablero
    // Then: falla con el mensaje del backend
    await expect(listarTareas('t')).rejects.toThrow('Caído');
    // Given: un backend que responde 500 sin JSON
    simular(new Response('x', { status: 500 }));
    // When: se lista el tablero
    // Then: falla con el mensaje genérico
    await expect(listarTareas('t')).rejects.toThrow('respondió 500');
  });

  test('sin red y sin URL', async () => {
    // Given: un fallo de red
    simular(new Error('offline'));
    // When: se lista el tablero
    // Then: falla con el mensaje de falta de conexión
    await expect(listarTareas('t')).rejects.toThrow(SIN_RED);
    // Given: PUBLIC_API_URL vacía
    process.env.PUBLIC_API_URL = '';
    // When: se lista el tablero
    // Then: falla pidiendo configurar PUBLIC_API_URL
    await expect(listarTareas('t')).rejects.toThrow(SIN_URL);
  });
});

describe('crearTarea', () => {
  const datos = {
    token: 't',
    titulo: 'Grifo',
    descripcion: 'Gotea',
    categoria: 'plomeria',
    ubicacion: 'Envigado',
  };

  test('publica la tarea sin enviar el token en el body', async () => {
    // Given: un backend que responde 201 con la tarea
    simular(json({ id: 't1' }, 201));
    // When: se publica la tarea
    expect((await crearTarea(datos)).id).toBe('t1');
    // Then: el cuerpo trae título, descripción, categoría y ubicación, sin el token
    expect(JSON.parse(String(ultima?.init?.body))).toEqual({
      titulo: 'Grifo',
      descripcion: 'Gotea',
      categoria: 'plomeria',
      ubicacion: 'Envigado',
      latitud: null,
      longitud: null,
    });
  });

  test('401, error del backend, sin red y sin URL', async () => {
    // Given: un backend que responde 401
    simular(json({}, 401));
    // When: se publica la tarea
    // Then: falla con ErrorSesionExpirada
    await expect(crearTarea(datos)).rejects.toBeInstanceOf(ErrorSesionExpirada);
    // Given: un backend que responde 400 con mensaje
    simular(json({ message: 'Datos inválidos' }, 400));
    // When: se publica la tarea
    // Then: falla con el mensaje del backend
    await expect(crearTarea(datos)).rejects.toThrow('Datos inválidos');
    // Given: un backend que responde 500 sin JSON
    simular(new Response('x', { status: 500 }));
    // When: se publica la tarea
    // Then: falla con el mensaje genérico
    await expect(crearTarea(datos)).rejects.toThrow('respondió 500');
    // Given: un fallo de red
    simular(new Error('offline'));
    // When: se publica la tarea
    // Then: falla con el mensaje de falta de conexión
    await expect(crearTarea(datos)).rejects.toThrow(SIN_RED);
    // Given: PUBLIC_API_URL vacía
    process.env.PUBLIC_API_URL = '';
    // When: se publica la tarea
    // Then: falla pidiendo configurar PUBLIC_API_URL
    await expect(crearTarea(datos)).rejects.toThrow(SIN_URL);
  });

  test('ErrorSesionExpirada tiene nombre y mensaje propios', () => {
    // Given: un ErrorSesionExpirada recién creado
    const e = new ErrorSesionExpirada();
    // When: se leen su nombre y su mensaje
    expect(e.name).toBe('ErrorSesionExpirada');
    // Then: tienen los valores propios de la sesión expirada
    expect(e.message).toContain('sesión ha expirado');
  });
});

describe('disponibilidad', () => {
  test('obtenerDisponibilidad devuelve los slots', async () => {
    // Given: un backend que responde con una franja
    simular(json([{ diaSemana: 1, franjaHoraria: 'manana' }]));
    // When: se lee la disponibilidad
    // Then: devuelve la franja
    expect(await obtenerDisponibilidad('t')).toHaveLength(1);
  });

  test('obtenerDisponibilidad: error, sin red y sin URL', async () => {
    // Given: un backend que responde 403 con mensaje
    simular(json({ message: 'Nope' }, 403));
    // When: se lee la disponibilidad
    // Then: falla con el mensaje del backend
    await expect(obtenerDisponibilidad('t')).rejects.toThrow('Nope');
    // Given: un backend que responde 500 sin JSON
    simular(new Response('x', { status: 500 }));
    // When: se lee la disponibilidad
    // Then: falla con el mensaje genérico
    await expect(obtenerDisponibilidad('t')).rejects.toThrow('respondió 500');
    // Given: un fallo de red
    simular(new Error('offline'));
    // When: se lee la disponibilidad
    // Then: falla con el mensaje de falta de conexión
    await expect(obtenerDisponibilidad('t')).rejects.toThrow(SIN_RED);
    // Given: PUBLIC_API_URL vacía
    process.env.PUBLIC_API_URL = '';
    // When: se lee la disponibilidad
    // Then: falla pidiendo configurar PUBLIC_API_URL
    await expect(obtenerDisponibilidad('t')).rejects.toThrow(SIN_URL);
  });

  test('guardarDisponibilidad envía el arreglo tal cual, incluso vacío', async () => {
    // Given: un backend que acepta el reemplazo
    simular(json([]));
    // When: se guarda un arreglo vacío
    await guardarDisponibilidad({ token: 't', slots: [] });
    // Then: se envía por PUT con { slots: [] } para limpiar
    expect(ultima?.init?.method).toBe('PUT');
    expect(JSON.parse(String(ultima?.init?.body))).toEqual({ slots: [] });
  });

  test('guardarDisponibilidad: error, sin red y sin URL', async () => {
    const args = { token: 't', slots: [{ dia: 1, franja: 'manana' }] };
    // Given: un backend que responde 400 con mensaje
    simular(json({ message: 'Franja inválida' }, 400));
    // When: se guarda la disponibilidad
    // Then: falla con el mensaje del backend
    await expect(guardarDisponibilidad(args)).rejects.toThrow(
      'Franja inválida'
    );
    // Given: un backend que responde 500 sin JSON
    simular(new Response('x', { status: 500 }));
    // When: se guarda la disponibilidad
    // Then: falla con el mensaje genérico
    await expect(guardarDisponibilidad(args)).rejects.toThrow('respondió 500');
    // Given: un fallo de red
    simular(new Error('offline'));
    // When: se guarda la disponibilidad
    // Then: falla con el mensaje de falta de conexión
    await expect(guardarDisponibilidad(args)).rejects.toThrow(SIN_RED);
    // Given: PUBLIC_API_URL vacía
    process.env.PUBLIC_API_URL = '';
    // When: se guarda la disponibilidad
    // Then: falla pidiendo configurar PUBLIC_API_URL
    await expect(guardarDisponibilidad(args)).rejects.toThrow(SIN_URL);
  });
});
