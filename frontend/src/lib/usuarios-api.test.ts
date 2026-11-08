/**
 * Pruebas del cliente HTTP del backend: `fetch` se simula, así que no hay
 * red. Cubre URL ausente, errores del backend (con y sin cuerpo), 401 como
 * sesión expirada y fallos de conexión.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  ErrorSesionExpirada,
  ErrorTareaNoDisponible,
  actualizarPerfil,
  crearTarea,
  crearCalificacion,
  enviarMensaje,
  guardarDisponibilidad,
  iniciarSesion,
  listarCalificaciones,
  listarConversacion,
  registrar,
  listarTareas,
  normalizarRolParaBackend,
  obtenerDisponibilidad,
  obtenerPerfil,
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

describe('listarCalificaciones (lectura sin token)', () => {
  test('llama a la ruta del usuario y devuelve la lista', async () => {
    // Given: un backend que responde con una lista
    simular(json([{ id: 'c1' }]));
    // When: se listan las calificaciones del usuario
    expect(await listarCalificaciones('u9')).toEqual([{ id: 'c1' } as never]);
    // Then: llama a /api/calificaciones/usuario/:id
    expect(ultima?.url).toBe('http://api.test/api/calificaciones/usuario/u9');
  });

  test('un error del backend llega con su mensaje', async () => {
    // Given: un backend que responde 400 con mensaje
    simular(json({ message: 'Id inválido.' }, 400));
    // When: se listan las calificaciones
    // Then: falla con ese mensaje
    await expect(listarCalificaciones('x')).rejects.toThrow('Id inválido.');
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

  test('crearCalificacion envía puntuación y tarea opcional', async () => {
    // Given: un backend que responde con la calificación
    simular(json({ id: 'c1' }, 201));
    // When: se califica sin tarea ni comentario
    await crearCalificacion({
      token: 'tk',
      destinatarioId: 'u2',
      puntuacion: 5,
    });
    // Then: la tarea viaja como null
    expect(ultima?.url).toBe('http://api.test/api/calificaciones');
    expect(JSON.parse(String(ultima?.init?.body))).toMatchObject({
      destinatarioId: 'u2',
      tareaId: null,
      puntuacion: 5,
    });
    // When: se califica con tarea
    await crearCalificacion({
      token: 'tk',
      destinatarioId: 'u2',
      tareaId: 't1',
      puntuacion: 4,
      comentario: 'Bien',
    });
    // Then: viaja la tarea y el comentario
    expect(JSON.parse(String(ultima?.init?.body))).toMatchObject({
      tareaId: 't1',
      comentario: 'Bien',
    });
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
