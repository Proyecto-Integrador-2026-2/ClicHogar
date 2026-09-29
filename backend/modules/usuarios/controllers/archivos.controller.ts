import { Elysia } from 'elysia';
import { NotFoundError } from '../../../shared/errors/app-error';

/**
 * Sirve las fotos de perfil guardadas en `uploads/perfiles/` (US-004).
 * El nombre se valida contra un patrón estricto (uuid + extensión
 * permitida): nada de `..` ni rutas arbitrarias (anti path-traversal).
 * Sin nombre exacto hay 404, traducido por el handler global de errores.
 */
const NOMBRE_SEGURO = /^[0-9a-f-]{36}\.(jpg|jpeg|png)$/;

const MIME_POR_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

export const archivosController = new Elysia({
  prefix: '/uploads/perfiles',
}).get('/:nombre', async ({ params }) => {
  const nombre = params.nombre.toLowerCase();
  if (!NOMBRE_SEGURO.test(nombre)) {
    throw new NotFoundError('Recurso no encontrado.');
  }
  const archivo = Bun.file(`uploads/perfiles/${nombre}`);
  if (!(await archivo.exists())) {
    throw new NotFoundError('Recurso no encontrado.');
  }
  const extension = nombre.split('.').pop() ?? '';
  return new Response(archivo, {
    headers: {
      'Content-Type':
        MIME_POR_EXTENSION[extension] ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=86400',
    },
  });
});
