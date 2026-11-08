import { Elysia, t } from 'elysia';
import { NotFoundError } from '../../../shared/errors/app-error';
import { authService } from '../../auth/services/auth.service';
import { tokenDesdeHeaders, usuarioDesdeHeaders } from '../../auth/token';
import { ActualizarPerfilDto } from '../dto/actualizar-perfil.dto';
import { DisponibilidadDto } from '../dto/disponibilidad.dto';
import { toUsuarioPublico } from '../mappers/usuario.mapper';
import { usuariosRepository } from '../repositories/usuarios.repository';
import { disponibilidadService } from '../services/disponibilidad.service';
import { perfilService } from '../services/perfil.service';

/** Parámetro `:id` (uuid del usuario): otro formato responde 400, no 500. */
const ParamsUsuarioDto = t.Object({ id: t.String({ format: 'uuid' }) });

/**
 * Módulo `usuarios`: perfil propio, disponibilidad y perfil público.
 * Todo exige Bearer válido salvo `GET /api/usuarios/:id` (perfil público).
 * `GET /api/usuarios/:id/disponibilidad` muestra el horario de un afiliado
 * a cualquier usuario con sesión (US-012, perfil del postulante).
 */
export const usuariosController = new Elysia({ prefix: '/api/usuarios' })
  .get('/yo', ({ headers }) => authService.me(tokenDesdeHeaders(headers)))
  .patch(
    '/yo',
    async ({ body, headers }) => {
      const usuario = await usuarioDesdeHeaders(headers);
      return perfilService.actualizarPerfil({
        usuarioId: usuario.id,
        descripcion: body.descripcion,
        ubicacion: body.ubicacion,
        foto: body.foto
          ? {
              datos: new Uint8Array(await body.foto.arrayBuffer()),
              mimeDeclarado: body.foto.type,
              tamano: body.foto.size,
            }
          : undefined,
      });
    },
    { body: ActualizarPerfilDto }
  )
  .put(
    '/disponibilidad',
    async ({ body, headers }) => {
      const usuario = await usuarioDesdeHeaders(headers);
      return disponibilidadService.guardar(usuario.id, body.slots);
    },
    { body: DisponibilidadDto }
  )
  .get('/disponibilidad', async ({ headers }) => {
    const usuario = await usuarioDesdeHeaders(headers);
    return disponibilidadService.obtener(usuario.id);
  })
  .get(
    '/:id/disponibilidad',
    async ({ params, headers }) => {
      await usuarioDesdeHeaders(headers);
      return disponibilidadService.obtener(params.id);
    },
    { params: ParamsUsuarioDto }
  )
  .get(
    '/:id',
    async ({ params }) => {
      const usuario = await usuariosRepository.buscarPorId(params.id);
      if (!usuario) throw new NotFoundError('Usuario no encontrado.');
      return toUsuarioPublico(usuario);
    },
    { params: ParamsUsuarioDto }
  );
