import { ConflictError, UnauthorizedError, ValidationError } from '../../../shared/errors/app-error';
import { usuariosRepository } from '../../usuarios/repositories/usuarios.repository';
import { sesionesRepository } from '../repositories/sesiones.repository';
import type { Usuario } from '../../usuarios/entities/usuario.entity';
import { toUsuarioPublico } from '../../usuarios/mappers/usuario.mapper';
import type { RolUsuario } from '../../usuarios/entities/usuario.entity';

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function normalizarEmail(email: unknown): string {
  if (typeof email !== 'string' || !email.includes('@')) {
    throw new ValidationError('Email inválido.');
  }
  return email.trim().toLowerCase();
}

function normalizarPassword(password: unknown): string {
  if (typeof password !== 'string' || password.length < 8) {
    throw new ValidationError('La contraseña debe tener al menos 8 caracteres.');
  }
  return password;
}

function normalizarRol(rol: unknown): RolUsuario {
  const v = typeof rol === 'string' ? rol.trim().toLowerCase() : '';
  if (v === 'afiliado') return 'afiliado';
  return 'cliente';
}

export const authService = {
  async register(args: {
    nombre?: unknown;
    email?: unknown;
    password?: unknown;
    rol?: unknown;
  }): Promise<{ token: string; usuario: ReturnType<typeof toUsuarioPublico> }> {
    const nombre =
      typeof args.nombre === 'string' && args.nombre.trim().length >= 2
        ? args.nombre.trim().slice(0, 120)
        : 'Usuario';
    const email = normalizarEmail(args.email);
    const password = normalizarPassword(args.password);
    const rol = normalizarRol(args.rol);

    const existente = await usuariosRepository.buscarPorEmail?.(email);
    if (existente) {
      throw new ConflictError('Ya existe una cuenta con ese email.');
    }

    const passwordHash = await Bun.password.hash(password);
    const usuario = await usuariosRepository.crear({
      clerkId: null,
      nombre,
      email,
      passwordHash,
      rol,
    });

    const token = crypto.randomUUID() + crypto.randomUUID();
    const expiraEn = new Date(Date.now() + TOKEN_TTL_MS);
    await sesionesRepository.crear(usuario.id, token, expiraEn);

    return { token, usuario: toUsuarioPublico(usuario) };
  },

  async login(args: {
    email?: unknown;
    password?: unknown;
  }): Promise<{ token: string; usuario: ReturnType<typeof toUsuarioPublico> }> {
    const email = normalizarEmail(args.email);
    const password = normalizarPassword(args.password);

    const usuario = await usuariosRepository.buscarPorEmail?.(email);
    if (!usuario || !usuario.passwordHash) {
      throw new UnauthorizedError('Credenciales inválidas.');
    }
    const ok = await Bun.password.verify(password, usuario.passwordHash);
    if (!ok) {
      throw new UnauthorizedError('Credenciales inválidas.');
    }

    const token = crypto.randomUUID() + crypto.randomUUID();
    const expiraEn = new Date(Date.now() + TOKEN_TTL_MS);
    await sesionesRepository.crear(usuario.id, token, expiraEn);

    return { token, usuario: toUsuarioPublico(usuario) };
  },

  async me(token: string) {
    const usuario = await this.resolverUsuario(token);
    return toUsuarioPublico(usuario);
  },

  async resolverUsuario(token: string): Promise<Usuario> {
    const usuarioId = await sesionesRepository.buscarUsuarioIdPorToken(token);
    if (!usuarioId) throw new UnauthorizedError('Sesión inválida o expirada.');
    const usuario = await usuariosRepository.buscarPorId(usuarioId);
    if (!usuario) throw new UnauthorizedError('Sesión inválida o expirada.');
    return usuario;
  },

  async logout(token: string): Promise<void> {
    await sesionesRepository.eliminar(token);
  },
};