import { Elysia } from 'elysia';
import { RegistrarUsuarioDto } from '../dto/registrar-usuario.dto';
import { registroService } from '../services/registro.service';

/**
 * Endpoints públicos del módulo `usuarios` (HU1: registro).
 * Rutas de autenticación (login/logout, HU2/HU3) se agregarán aquí mismo
 * o en un auth.controller.ts dedicado dentro de este módulo.
 */
export const usuariosController = new Elysia({ prefix: '/api/usuarios' }).post(
  '/',
  async ({ body, set }) => {
    const usuario = await registroService.registrarUsuario(body);
    set.status = 201;
    return usuario;
  },
  {
    body: RegistrarUsuarioDto,
  }
);
