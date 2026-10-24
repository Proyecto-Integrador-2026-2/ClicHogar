/**
 * Pruebas del cliente HTTP del backend: `fetch` se simula, así que no hay
 * red. Cubre URL ausente, errores del backend (con y sin cuerpo), 401 como
 * sesión expirada y fallos de conexión.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  ErrorSesionExpirada,
  actualizarPerfil,
  crearTarea,
  guardarDisponibilidad,
  listarTareas,
  normalizarRolParaBackend,
  obtenerDisponibilidad,
  obtenerPerfil,
  sincronizarUsuarioConBackend,
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

describe('sincronizarUsuarioConBackend', () => {
  const args = { token: 't', nombre: 'Ana', rol: 'Afiliado' };

  test('envía token y rol normalizado y devuelve el usuario', async () => {
    // Given: un backend que responde con el usuario
    simular(json({ id: 'u1' }));
    // When: se sincroniza con rol 'Afiliado'
    expect((await sincronizarUsuarioConBackend(args)).id).toBe('u1');
    // Then: llama a /api/usuarios/sync con el rol normalizado y devuelve el usuario
    expect(ultima?.url).toBe('http://api.test/api/usuarios/sync');
    expect(JSON.parse(String(ultima?.init?.body))).toEqual({
      nombre: 'Ana',
      rol: 'afiliado',
    });
  });

  test('propaga el mensaje del backend, o un genérico sin cuerpo', async () => {
    // Given: un backend que responde 409 con un mensaje
    simular(json({ message: 'Correo en uso' }, 409));
    // When: se sincroniza
    // Then: falla con el mensaje del backend
    await expect(sincronizarUsuarioConBackend(args)).rejects.toThrow(
      'Correo en uso'
    );
    // Given: un backend que responde 500 sin JSON
    simular(new Response('no json', { status: 500 }));
    // When: se sincroniza
    // Then: falla con el mensaje genérico con el status
    await expect(sincronizarUsuarioConBackend(args)).rejects.toThrow(
      'El backend respondió 500.'
    );
  });

  test('un fallo de red sin mensaje amigable se propaga tal cual', async () => {
    // Given: un fallo de red al llamar al backend
    simular(new Error('offline'));
    // When: se sincroniza
    // Then: el error se propaga tal cual, sin mensaje amigable
    await expect(sincronizarUsuarioConBackend(args)).rejects.toThrow('offline');
  });

  test('falla sin PUBLIC_API_URL', async () => {
    // Given: PUBLIC_API_URL vacía
    process.env.PUBLIC_API_URL = '';
    // When: se sincroniza
    // Then: falla pidiendo configurar PUBLIC_API_URL
    await expect(sincronizarUsuarioConBackend(args)).rejects.toThrow(SIN_URL);
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
    // Given: un backend que responde 401 con mensaje
    simular(json({ message: 'No autorizado' }, 401));
    // When: se lee el perfil
    // Then: falla con ese mensaje
    await expect(obtenerPerfil('t')).rejects.toThrow('No autorizado');
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
  test('devuelve el tablero', async () => {
    // Given: un backend que responde con una tarea
    simular(json([{ id: 't1' }]));
    // When: se lista el tablero
    // Then: devuelve esa tarea
    expect(await listarTareas('t')).toEqual([{ id: 't1' } as never]);
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
