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
    expect(normalizarRolParaBackend(' Afiliado ')).toBe('afiliado');
    expect(normalizarRolParaBackend('Usuario')).toBe('cliente');
  });
});

describe('urlPublica', () => {
  test('antepone la URL del API si existe', () => {
    expect(urlPublica('/uploads/a.jpg')).toBe('http://api.test/uploads/a.jpg');
  });

  test('sin URL devuelve la ruta tal cual', () => {
    process.env.PUBLIC_API_URL = '';
    expect(urlPublica('/uploads/a.jpg')).toBe('/uploads/a.jpg');
  });
});

describe('sincronizarUsuarioConBackend', () => {
  const args = { token: 't', nombre: 'Ana', rol: 'Afiliado' };

  test('envía token y rol normalizado y devuelve el usuario', async () => {
    simular(json({ id: 'u1' }));
    expect((await sincronizarUsuarioConBackend(args)).id).toBe('u1');
    expect(ultima?.url).toBe('http://api.test/api/usuarios/sync');
    expect(JSON.parse(String(ultima?.init?.body))).toEqual({
      nombre: 'Ana',
      rol: 'afiliado',
    });
  });

  test('propaga el mensaje del backend, o un genérico sin cuerpo', async () => {
    simular(json({ message: 'Correo en uso' }, 409));
    await expect(sincronizarUsuarioConBackend(args)).rejects.toThrow(
      'Correo en uso'
    );
    simular(new Response('no json', { status: 500 }));
    await expect(sincronizarUsuarioConBackend(args)).rejects.toThrow(
      'El backend respondió 500.'
    );
  });

  test('falla sin PUBLIC_API_URL', async () => {
    process.env.PUBLIC_API_URL = '';
    await expect(sincronizarUsuarioConBackend(args)).rejects.toThrow(SIN_URL);
  });
});

describe('obtenerPerfil', () => {
  test('lee el perfil con el token', async () => {
    simular(json({ id: 'u1' }));
    expect((await obtenerPerfil('t')).id).toBe('u1');
    expect(ultima?.url).toBe('http://api.test/api/usuarios/yo');
  });

  test('errores del backend y URL ausente', async () => {
    simular(json({ message: 'No autorizado' }, 401));
    await expect(obtenerPerfil('t')).rejects.toThrow('No autorizado');
    simular(new Response('x', { status: 500 }));
    await expect(obtenerPerfil('t')).rejects.toThrow('respondió 500');
    process.env.PUBLIC_API_URL = '';
    await expect(obtenerPerfil('t')).rejects.toThrow(SIN_URL);
  });
});

describe('actualizarPerfil', () => {
  test('solo envía los campos presentes (multipart)', async () => {
    simular(json({ id: 'u1' }));
    const foto = new File([new Uint8Array([1])], 'f.png', {
      type: 'image/png',
    });
    await actualizarPerfil({
      token: 't',
      foto,
      descripcion: 'Hola',
      ubicacion: 'Envigado',
    });
    const forma = ultima?.init?.body as FormData;
    expect(ultima?.init?.method).toBe('PATCH');
    expect(forma.get('descripcion')).toBe('Hola');
    expect(forma.get('ubicacion')).toBe('Envigado');
    expect(forma.get('foto')).toBeInstanceOf(File);

    await actualizarPerfil({ token: 't' });
    const vacia = ultima?.init?.body as FormData;
    expect([...vacia.keys()]).toEqual([]);
  });

  test('errores del backend y URL ausente', async () => {
    simular(json({ message: 'Foto muy pesada' }, 400));
    await expect(actualizarPerfil({ token: 't' })).rejects.toThrow(
      'Foto muy pesada'
    );
    simular(new Response('x', { status: 500 }));
    await expect(actualizarPerfil({ token: 't' })).rejects.toThrow(
      'respondió 500'
    );
    process.env.PUBLIC_API_URL = '';
    await expect(actualizarPerfil({ token: 't' })).rejects.toThrow(SIN_URL);
  });
});

describe('listarTareas', () => {
  test('devuelve el tablero', async () => {
    simular(json([{ id: 't1' }]));
    expect(await listarTareas('t')).toEqual([{ id: 't1' } as never]);
  });

  test('401 -> sesión expirada; otros errores con mensaje', async () => {
    simular(json({}, 401));
    await expect(listarTareas('t')).rejects.toBeInstanceOf(ErrorSesionExpirada);
    simular(json({ message: 'Caído' }, 503));
    await expect(listarTareas('t')).rejects.toThrow('Caído');
    simular(new Response('x', { status: 500 }));
    await expect(listarTareas('t')).rejects.toThrow('respondió 500');
  });

  test('sin red y sin URL', async () => {
    simular(new Error('offline'));
    await expect(listarTareas('t')).rejects.toThrow(SIN_RED);
    process.env.PUBLIC_API_URL = '';
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
    simular(json({ id: 't1' }, 201));
    expect((await crearTarea(datos)).id).toBe('t1');
    expect(JSON.parse(String(ultima?.init?.body))).toEqual({
      titulo: 'Grifo',
      descripcion: 'Gotea',
      categoria: 'plomeria',
      ubicacion: 'Envigado',
    });
  });

  test('401, error del backend, sin red y sin URL', async () => {
    simular(json({}, 401));
    await expect(crearTarea(datos)).rejects.toBeInstanceOf(ErrorSesionExpirada);
    simular(json({ message: 'Datos inválidos' }, 400));
    await expect(crearTarea(datos)).rejects.toThrow('Datos inválidos');
    simular(new Response('x', { status: 500 }));
    await expect(crearTarea(datos)).rejects.toThrow('respondió 500');
    simular(new Error('offline'));
    await expect(crearTarea(datos)).rejects.toThrow(SIN_RED);
    process.env.PUBLIC_API_URL = '';
    await expect(crearTarea(datos)).rejects.toThrow(SIN_URL);
  });

  test('ErrorSesionExpirada tiene nombre y mensaje propios', () => {
    const e = new ErrorSesionExpirada();
    expect(e.name).toBe('ErrorSesionExpirada');
    expect(e.message).toContain('sesión ha expirado');
  });
});

describe('disponibilidad', () => {
  test('obtenerDisponibilidad devuelve los slots', async () => {
    simular(json([{ diaSemana: 1, franjaHoraria: 'manana' }]));
    expect(await obtenerDisponibilidad('t')).toHaveLength(1);
  });

  test('obtenerDisponibilidad: error, sin red y sin URL', async () => {
    simular(json({ message: 'Nope' }, 403));
    await expect(obtenerDisponibilidad('t')).rejects.toThrow('Nope');
    simular(new Response('x', { status: 500 }));
    await expect(obtenerDisponibilidad('t')).rejects.toThrow('respondió 500');
    simular(new Error('offline'));
    await expect(obtenerDisponibilidad('t')).rejects.toThrow(SIN_RED);
    process.env.PUBLIC_API_URL = '';
    await expect(obtenerDisponibilidad('t')).rejects.toThrow(SIN_URL);
  });

  test('guardarDisponibilidad envía el arreglo tal cual, incluso vacío', async () => {
    simular(json([]));
    await guardarDisponibilidad({ token: 't', slots: [] });
    expect(ultima?.init?.method).toBe('PUT');
    expect(JSON.parse(String(ultima?.init?.body))).toEqual({ slots: [] });
  });

  test('guardarDisponibilidad: error, sin red y sin URL', async () => {
    const args = { token: 't', slots: [{ dia: 1, franja: 'manana' }] };
    simular(json({ message: 'Franja inválida' }, 400));
    await expect(guardarDisponibilidad(args)).rejects.toThrow(
      'Franja inválida'
    );
    simular(new Response('x', { status: 500 }));
    await expect(guardarDisponibilidad(args)).rejects.toThrow('respondió 500');
    simular(new Error('offline'));
    await expect(guardarDisponibilidad(args)).rejects.toThrow(SIN_RED);
    process.env.PUBLIC_API_URL = '';
    await expect(guardarDisponibilidad(args)).rejects.toThrow(SIN_URL);
  });
});
