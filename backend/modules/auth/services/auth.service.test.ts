/**
 * Pruebas del servicio de autenticación: registro, login, sesión y logout.
 * Repositorios simulados (sin Postgres); el hash de contraseña es real.
 */
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import {
  ConflictError,
  UnauthorizedError,
  ValidationError,
} from '../../../shared/errors/app-error';
import type { Usuario } from '../../usuarios/entities/usuario.entity';
import { usuariosRepository } from '../../usuarios/repositories/usuarios.repository';
import { sesionesRepository } from '../repositories/sesiones.repository';
import { TOKEN_TTL_MS, authService } from './auth.service';

afterEach(() => {
  mock.restore();
});

const FECHA = new Date('2026-01-01T00:00:00.000Z');

function usuario(cambios: Partial<Usuario> = {}): Usuario {
  return {
    id: 'u-1',
    nombre: 'Ana',
    email: 'ana@ejemplo.com',
    passwordHash: null,
    rol: 'cliente',
    fotoUrl: null,
    descripcion: null,
    ubicacion: null,
    activo: true,
    creadoEn: FECHA,
    actualizadoEn: FECHA,
    ...cambios,
  };
}

/** Repositorios en memoria: sin usuario previo y con la sesión creada capturada. */
function repositorios() {
  const crear = spyOn(usuariosRepository, 'crear').mockImplementation(
    async (datos) => usuario({ ...datos, id: 'nuevo' })
  );
  const sesion = spyOn(sesionesRepository, 'crear').mockResolvedValue();
  spyOn(usuariosRepository, 'buscarPorEmail').mockResolvedValue(undefined);
  return { crear, sesion };
}

describe('authService.register', () => {
  test('crea la cuenta con hash, normaliza datos y abre sesión', async () => {
    // Given: un correo libre
    const { crear, sesion } = repositorios();
    const antes = Date.now();
    // When: se registra con correo en mayúsculas y rol 'Afiliado'
    const resultado = await authService.register({
      nombre: '  Ana Pérez  ',
      email: ' ANA@Ejemplo.com ',
      password: 'Secreta123',
      rol: ' Afiliado ',
    });
    // Then: guarda el correo y el nombre saneados, el rol y un hash (no la clave)
    const guardado = crear.mock.calls[0]![0];
    expect(guardado).toMatchObject({
      nombre: 'Ana Pérez',
      email: 'ana@ejemplo.com',
      rol: 'afiliado',
    });
    expect(guardado.passwordHash).not.toBe('Secreta123');
    expect(
      await Bun.password.verify('Secreta123', guardado.passwordHash!)
    ).toBe(true);
    // Then: abre una sesión de 7 días y devuelve el usuario público sin hash
    const [usuarioId, token, expira] = sesion.mock.calls[0]!;
    expect(usuarioId).toBe('nuevo');
    expect(token).toBe(resultado.token);
    expect(token.length).toBeGreaterThanOrEqual(64);
    expect(expira.getTime() - antes).toBeGreaterThanOrEqual(
      TOKEN_TTL_MS - 1000
    );
    expect(resultado.usuario).not.toHaveProperty('passwordHash');
    expect(resultado.usuario.rol).toBe('afiliado');
  });

  test('sin nombre válido usa "Usuario"; un rol desconocido es cliente', async () => {
    // Given: un correo libre
    const { crear } = repositorios();
    // When: se registra con un nombre demasiado corto y un rol cualquiera
    await authService.register({
      nombre: 'A',
      email: 'a@b.co',
      password: 'Secreta123',
      rol: 'admin',
    });
    // Then: usa el nombre por defecto y el rol cliente
    expect(crear.mock.calls[0]![0]).toMatchObject({
      nombre: 'Usuario',
      rol: 'cliente',
    });
  });

  test('un nombre o rol que no son texto también caen en los valores por defecto', async () => {
    // Given: un correo libre
    const { crear } = repositorios();
    // When: se registra sin nombre ni rol
    await authService.register({ email: 'a@b.co', password: 'Secreta123' });
    // Then: usa 'Usuario' y 'cliente'
    expect(crear.mock.calls[0]![0]).toMatchObject({
      nombre: 'Usuario',
      rol: 'cliente',
    });
  });

  test('un nombre largo se recorta a 120 caracteres', async () => {
    // Given: un correo libre
    const { crear } = repositorios();
    // When: se registra con un nombre de 200 letras
    await authService.register({
      nombre: 'x'.repeat(200),
      email: 'a@b.co',
      password: 'Secreta123',
    });
    // Then: se guardan 120
    expect(crear.mock.calls[0]![0].nombre).toHaveLength(120);
  });

  test('correo repetido: ConflictError y no crea nada', async () => {
    // Given: un correo que ya existe
    const { crear } = repositorios();
    spyOn(usuariosRepository, 'buscarPorEmail').mockResolvedValue(usuario());
    // When: se intenta registrar
    // Then: falla con ConflictError sin crear al usuario
    await expect(
      authService.register({ email: 'ana@ejemplo.com', password: 'Secreta123' })
    ).rejects.toBeInstanceOf(ConflictError);
    expect(crear).not.toHaveBeenCalled();
  });

  test.each([
    [{ email: 'sin-arroba', password: 'Secreta123' }],
    [{ email: 42, password: 'Secreta123' }],
    [{ password: 'Secreta123' }],
    [{ email: 'a@b.co', password: 'corta' }],
    [{ email: 'a@b.co', password: 12345678 }],
    [{ email: 'a@b.co' }],
  ])('rechaza datos inválidos %j', async (args) => {
    // Given: datos de registro inválidos
    repositorios();
    // When: se intenta registrar
    // Then: falla con ValidationError
    await expect(authService.register(args)).rejects.toBeInstanceOf(
      ValidationError
    );
  });
});

describe('authService.login', () => {
  test('con credenciales correctas abre una sesión', async () => {
    // Given: un usuario con contraseña guardada
    const hash = await Bun.password.hash('Secreta123');
    spyOn(usuariosRepository, 'buscarPorEmail').mockResolvedValue(
      usuario({ passwordHash: hash })
    );
    const sesion = spyOn(sesionesRepository, 'crear').mockResolvedValue();
    // When: inicia sesión con el correo en mayúsculas
    const resultado = await authService.login({
      email: 'ANA@ejemplo.com',
      password: 'Secreta123',
    });
    // Then: devuelve el token y el usuario público, y guarda la sesión
    expect(resultado.usuario.id).toBe('u-1');
    expect(resultado.usuario).not.toHaveProperty('passwordHash');
    expect(sesion).toHaveBeenCalledTimes(1);
    expect(sesion.mock.calls[0]![1]).toBe(resultado.token);
  });

  test('correo desconocido, usuario sin contraseña o clave mala: mismo 401', async () => {
    const buscar = spyOn(usuariosRepository, 'buscarPorEmail');
    const sesion = spyOn(sesionesRepository, 'crear').mockResolvedValue();
    // Given: un correo que no existe
    buscar.mockResolvedValue(undefined);
    // When / Then: falla con UnauthorizedError
    await expect(
      authService.login({ email: 'x@y.co', password: 'Secreta123' })
    ).rejects.toThrow('Credenciales inválidas.');
    // Given: un usuario sin contraseña (cuenta heredada)
    buscar.mockResolvedValue(usuario({ passwordHash: null }));
    // When / Then: mismo error
    await expect(
      authService.login({ email: 'ana@ejemplo.com', password: 'Secreta123' })
    ).rejects.toBeInstanceOf(UnauthorizedError);
    // Given: una contraseña incorrecta
    buscar.mockResolvedValue(
      usuario({ passwordHash: await Bun.password.hash('Otra-clave-1') })
    );
    // When / Then: mismo error y no se abre sesión
    await expect(
      authService.login({ email: 'ana@ejemplo.com', password: 'Secreta123' })
    ).rejects.toThrow('Credenciales inválidas.');
    expect(sesion).not.toHaveBeenCalled();
  });

  test('valida el formato antes de consultar la base', async () => {
    // Given: un repositorio que no debería usarse
    const buscar = spyOn(usuariosRepository, 'buscarPorEmail');
    // When / Then: correo o clave inválidos fallan con ValidationError
    await expect(
      authService.login({ email: 'sin-arroba', password: 'Secreta123' })
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      authService.login({ email: 'a@b.co', password: 'corta' })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(buscar).not.toHaveBeenCalled();
  });
});

describe('authService.resolverUsuario / me / logout', () => {
  test('resolverUsuario devuelve al dueño del token', async () => {
    // Given: un token vigente de u-1
    spyOn(sesionesRepository, 'buscarUsuarioIdPorToken').mockResolvedValue(
      'u-1'
    );
    spyOn(usuariosRepository, 'buscarPorId').mockResolvedValue(usuario());
    // When: se resuelve el token
    // Then: devuelve el usuario
    expect((await authService.resolverUsuario('tok')).id).toBe('u-1');
  });

  test('token desconocido o usuario borrado: 401', async () => {
    const buscarToken = spyOn(sesionesRepository, 'buscarUsuarioIdPorToken');
    const buscarUsuario = spyOn(usuariosRepository, 'buscarPorId');
    // Given: un token que no existe o expiró
    buscarToken.mockResolvedValue(undefined);
    // When / Then: falla sin consultar usuarios
    await expect(authService.resolverUsuario('x')).rejects.toThrow(
      'Sesión inválida o expirada.'
    );
    expect(buscarUsuario).not.toHaveBeenCalled();
    // Given: un token vigente cuyo usuario ya no existe
    buscarToken.mockResolvedValue('u-1');
    buscarUsuario.mockResolvedValue(undefined);
    // When / Then: también 401
    await expect(authService.resolverUsuario('x')).rejects.toBeInstanceOf(
      UnauthorizedError
    );
  });

  test('me devuelve el perfil público', async () => {
    // Given: un token vigente
    spyOn(sesionesRepository, 'buscarUsuarioIdPorToken').mockResolvedValue(
      'u-1'
    );
    spyOn(usuariosRepository, 'buscarPorId').mockResolvedValue(
      usuario({ passwordHash: 'secreto' })
    );
    // When: se pide la sesión actual
    const yo = await authService.me('tok');
    // Then: es la forma pública, sin hash
    expect(yo).toMatchObject({ id: 'u-1', email: 'ana@ejemplo.com' });
    expect(yo).not.toHaveProperty('passwordHash');
  });

  test('logout elimina la sesión', async () => {
    // Given: un repositorio de sesiones
    const eliminar = spyOn(sesionesRepository, 'eliminar').mockResolvedValue();
    // When: se cierra la sesión
    await authService.logout('tok');
    // Then: se elimina ese token
    expect(eliminar).toHaveBeenCalledWith('tok');
  });
});
