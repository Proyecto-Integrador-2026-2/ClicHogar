/**
 * Pruebas del servidor de fotos de perfil: patrón estricto de nombre
 * (anti path-traversal), 404 y Content-Type por extensión. Incluye
 * /health, que vive en `app.ts`.
 */
import { afterAll, describe, expect, test } from 'bun:test';
import { mkdir, rm } from 'node:fs/promises';

process.env.DATABASE_URL ??= 'postgres://test';
process.env.CLERK_SECRET_KEY ??= 'sk_test';

const { buildApp } = await import('../../../app');

const UUID = '123e4567-e89b-12d3-a456-426614174000';
const creados: string[] = [];

function pedir(nombre: string) {
  return buildApp().handle(
    new Request(`http://localhost/uploads/perfiles/${nombre}`)
  );
}

async function crearArchivo(nombre: string) {
  await mkdir('uploads/perfiles', { recursive: true });
  const ruta = `uploads/perfiles/${nombre}`;
  await Bun.write(ruta, new Uint8Array([1, 2, 3]));
  creados.push(ruta);
}

afterAll(async () => {
  await Promise.all(creados.map((ruta) => rm(ruta, { force: true })));
});

describe('GET /uploads/perfiles/:nombre', () => {
  test('rechaza nombres que no son uuid + extensión permitida', async () => {
    // Given: nombres que no son uuid con extensión permitida
    // When: se pide cada uno
    // Then: todos responden 404
    expect((await pedir('foto.jpg')).status).toBe(404);
    expect((await pedir(`${UUID}.gif`)).status).toBe(404);
  });

  test('404 si el archivo no existe', async () => {
    // Given: un uuid válido sin archivo en disco
    // When: se pide la imagen
    // Then: responde 404
    expect((await pedir(`${UUID}.png`)).status).toBe(404);
  });

  test('sirve la imagen con su Content-Type y caché', async () => {
    // Given: una imagen JPG guardada en disco
    await crearArchivo(`${UUID}.jpg`);
    // When: se pide su nombre (en mayúsculas)
    const res = await pedir(`${UUID}.jpg`.toUpperCase());
    // Then: responde 200 con Content-Type image/jpeg y caché de un día
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(res.headers.get('cache-control')).toBe('public, max-age=86400');
  });

  test('PNG se sirve como image/png', async () => {
    // Given: una imagen PNG guardada en disco
    const nombre = '223e4567-e89b-12d3-a456-426614174000.png';
    await crearArchivo(nombre);
    // When: se pide la imagen
    const res = await pedir(nombre);
    // Then: responde con Content-Type image/png
    expect(res.headers.get('content-type')).toBe('image/png');
  });
});

describe('GET /health', () => {
  test('responde ok', async () => {
    // Given: la app construida sin abrir un puerto
    // When: se pide GET /health
    const res = await buildApp().handle(new Request('http://localhost/health'));
    // Then: responde { status: 'ok' }
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});
