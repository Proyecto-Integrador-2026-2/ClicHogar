import { Elysia } from 'elysia';
import { authService } from '../../auth/services/auth.service';
import { ActualizarPerfilDto } from '../dto/actualizar-perfil.dto';
import { DisponibilidadDto } from '../dto/disponibilidad.dto';
import { disponibilidadService } from '../services/disponibilidad.service';
import { perfilService } from '../services/perfil.service';
import { toUsuarioPublico } from '../mappers/usuario.mapper';

function tokenDesdeHeaders(headers: Record<string, string | undefined>): string {
  const auth = headers.authorization ?? headers.Authorization;
  if (!auth?.startsWith('Bearer ')) return '';
  return auth.slice('Bearer '.length).trim();
}

async function usuarioIdDesdeHeaders(headers: Record<string, string | undefined>): Promise<string> {
  const usuario = await authService.resolverUsuario(tokenDesdeHeaders(headers));
  return usuario.id;
}

export const usuariosController = new Elysia({ prefix: '/api/usuarios' })
  .get('/yo', async ({ headers }) => {
    return authService.me(tokenDesdeHeaders(headers as any));
  })
  .patch(
    '/yo',
    async ({ body, headers }) => {
      const usuarioId = await usuarioIdDesdeHeaders(headers as any);
      return perfilService.actualizarPerfil({
        usuarioId,
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
      const usuarioId = await usuarioIdDesdeHeaders(headers as any);
      return disponibilidadService.guardar(usuarioId, body.slots);
    },
    { body: DisponibilidadDto }
  )
  .get('/disponibilidad', async ({ headers }) => {
    const usuarioId = await usuarioIdDesdeHeaders(headers as any);
    return disponibilidadService.obtener(usuarioId);
  })
  .get('/:id', async ({ params }) => {
    const { usuariosRepository } = await import('../repositories/usuarios.repository');
    const { toUsuarioPublico } = await import('../mappers/usuario.mapper');
    const { NotFoundError } = await import('../../../shared/errors/app-error');
    const usuario = await usuariosRepository.buscarPorId(params.id);
    if (!usuario) throw new NotFoundError('Usuario no encontrado.');
    return toUsuarioPublico(usuario);
  });