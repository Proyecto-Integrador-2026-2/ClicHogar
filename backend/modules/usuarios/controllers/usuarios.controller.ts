import { Elysia } from 'elysia';
import {
  verificarSesionClerk,
  type SesionClerk,
} from '../../../shared/auth/clerk';
import { NotFoundError } from '../../../shared/errors/app-error';
import { RegistrarUsuarioDto } from '../dto/registrar-usuario.dto';
import { SincronizarUsuarioDto } from '../dto/sincronizar-usuario.dto';
import { registroService } from '../services/registro.service';
import { usuariosRepository } from '../repositories/usuarios.repository';
import { toUsuarioPublico } from '../mappers/usuario.mapper';

/**
 * Extrae y verifica la sesión Clerk del header `Authorization`.
 * Centraliza el 401: ningún handler toca tokens sin verificar.
 */
async function sesionDesdeHeaders(
  headers: Record<string, string | undefined>
): Promise<SesionClerk> {
  return verificarSesionClerk(headers['authorization']);
}

/**
 * Módulo `usuarios` (US-001 con Clerk).
 * - POST /api/usuarios/sync: crea o devuelve el usuario local a partir del
 *   session token de Clerk (flujo principal US-001). La identidad se extrae
 *   del token verificado, nunca del body.
 * - GET /api/usuarios/yo: devuelve el perfil local del usuario autenticado.
 * - POST /api/usuarios/: flujo legacy con password (pre-Clerk). Se mantiene
 *   por compatibilidad pero está deprecado: los clientes nuevos deben usar
 *   Clerk + /sync.
 */
export const usuariosController = new Elysia({ prefix: '/api/usuarios' })
  .post(
    '/sync',
    async ({ body, headers, set }) => {
      const sesionClerk = await sesionDesdeHeaders(headers);
      const { usuario, creado } = await registroService.sincronizarDesdeClerk(
        sesionClerk,
        body
      );
      set.status = creado ? 201 : 200;
      return usuario;
    },
    { body: SincronizarUsuarioDto }
  )
  .get('/yo', async ({ headers }) => {
    const sesionClerk = await sesionDesdeHeaders(headers);
    const usuario = await usuariosRepository.buscarPorClerkId(
      sesionClerk.clerkId
    );
    if (!usuario) {
      throw new NotFoundError(
        'Aún no tienes perfil local. Llama a POST /api/usuarios/sync primero.'
      );
    }
    return toUsuarioPublico(usuario);
  })
  .post(
    '/',
    async ({ body, set }) => {
      const usuario = await registroService.registrarUsuario(body);
      set.status = 201;
      return usuario;
    },
    {
      body: RegistrarUsuarioDto,
      detail: {
        deprecated: true,
        description:
          'Legacy pre-Clerk. Usa POST /api/usuarios/sync con session token.',
      },
    }
  );
