import {
  ConflictError,
  UnauthorizedError,
  ValidationError,
} from '../../../shared/errors/app-error';
import type {
  RolUsuario,
  Usuario,
} from '../../usuarios/entities/usuario.entity';
import { toUsuarioPublico } from '../../usuarios/mappers/usuario.mapper';
import { usuariosRepository } from '../../usuarios/repositories/usuarios.repository';
import { sesionesRepository } from '../repositories/sesiones.repository';

/** Vigencia de una sesión: 7 días. */
export const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type RespuestaSesion = {
  token: string;
  usuario: ReturnType<typeof toUsuarioPublico>;
};

function normalizarEmail(email: unknown): string {
  if (typeof email !== 'string' || !email.includes('@')) {
    throw new ValidationError('Email inválido.');
  }
  return email.trim().toLowerCase();
}

function normalizarPassword(password: unknown): string {
  if (typeof password !== 'string' || password.length < 8) {
    throw new ValidationError(
      'La contraseña debe tener al menos 8 caracteres.'
    );
  }
  return password;
}

function normalizarRol(rol: unknown): RolUsuario {
  const v = typeof rol === 'string' ? rol.trim().toLowerCase() : '';
  return v === 'afiliado' ? 'afiliado' : 'cliente';
}

function normalizarNombre(nombre: unknown): string {
  return typeof nombre === 'string' && nombre.trim().length >= 2
    ? nombre.trim().slice(0, 120)
    : 'Usuario';
}

/** Crea una sesión nueva para el usuario y devuelve su token. */
async function abrirSesion(usuario: Usuario): Promise<RespuestaSesion> {
  const token = crypto.randomUUID() + crypto.randomUUID();
  await sesionesRepository.crear(
    usuario.id,
    token,
    new Date(Date.now() + TOKEN_TTL_MS)
  );
  return { token, usuario: toUsuarioPublico(usuario) };
}

export const authService = {
  /** Alta de cuenta (correo único, contraseña con hash) y sesión abierta. */
  async register(args: {
    nombre?: unknown;
    email?: unknown;
    password?: unknown;
    rol?: unknown;
  }): Promise<RespuestaSesion> {
    const email = normalizarEmail(args.email);
    const password = normalizarPassword(args.password);

    if (await usuariosRepository.buscarPorEmail(email)) {
      throw new ConflictError('Ya existe una cuenta con ese email.');
    }

    const usuario = await usuariosRepository.crear({
      nombre: normalizarNombre(args.nombre),
      email,
      passwordHash: await Bun.password.hash(password),
      rol: normalizarRol(args.rol),
    });
    return abrirSesion(usuario);
  },

  /** Inicio de sesión: mismo error para correo desconocido y clave mala. */
  async login(args: {
    email?: unknown;
    password?: unknown;
  }): Promise<RespuestaSesion> {
    const email = normalizarEmail(args.email);
    const password = normalizarPassword(args.password);

    const usuario = await usuariosRepository.buscarPorEmail(email);
    if (
      !usuario?.passwordHash ||
      !(await Bun.password.verify(password, usuario.passwordHash))
    ) {
      throw new UnauthorizedError('Credenciales inválidas.');
    }
    return abrirSesion(usuario);
  },

  async me(token: string) {
    return toUsuarioPublico(await this.resolverUsuario(token));
  },

  /** Usuario dueño de un token vigente; 401 si no existe o expiró. */
  async resolverUsuario(token: string): Promise<Usuario> {
    const usuarioId = await sesionesRepository.buscarUsuarioIdPorToken(token);
    const usuario = usuarioId
      ? await usuariosRepository.buscarPorId(usuarioId)
      : undefined;
    if (!usuario) throw new UnauthorizedError('Sesión inválida o expirada.');
    return usuario;
  },

  async logout(token: string): Promise<void> {
    await sesionesRepository.eliminar(token);
  },
};
