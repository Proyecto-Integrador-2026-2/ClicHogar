/**
 * Pruebas del registro (US-001 y legacy pre-Clerk) con repositorio
 * simulado (sin Postgres). El hash argon2id sí es real: verifica que
 * la contraseña jamás se guarda en texto plano.
 */
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { ConflictError } from '../../../shared/errors/app-error';
import type { SesionClerk } from '../../../shared/auth/clerk';
import type { Usuario } from '../entities/usuario.entity';
import { usuariosRepository } from '../repositories/usuarios.repository';
import { registroService } from './registro.service';

afterEach(() => {
  mock.restore();
});

const SESION: SesionClerk = {
  clerkId: 'clerk-1',
  email: 'ana@ejemplo.com',
  nombre: 'Ana de Clerk',
  rolClerk: undefined,
};

function filaUsuario(cambios: Partial<Usuario> = {}): Usuario {
  return {
    id: 'u-1',
    clerkId: 'clerk-1',
    nombre: 'Ana',
    email: 'ana@ejemplo.com',
    passwordHash: null,
    rol: 'cliente',
    fotoUrl: null,
    descripcion: null,
    ubicacion: null,
    activo: true,
    creadoEn: new Date('2026-01-01T00:00:00.000Z'),
    actualizadoEn: new Date('2026-01-01T00:00:00.000Z'),
    ...cambios,
  };
}

describe('registroService.sincronizarDesdeClerk', () => {
  test('idempotente: si existe devuelve sin crear', async () => {
    const existente = filaUsuario();
    spyOn(usuariosRepository, 'buscarPorClerkId').mockResolvedValue(existente);
    const crear = spyOn(usuariosRepository, 'crear');

    const resultado = await registroService.sincronizarDesdeClerk(SESION, {});

    expect(resultado).toEqual({
      usuario: expect.objectContaining({ id: 'u-1' }),
      creado: false,
    });
    expect(crear).not.toHaveBeenCalled();
  });

  test('crea con rol del body y nombre recortado', async () => {
    spyOn(usuariosRepository, 'buscarPorClerkId').mockResolvedValue(null);
    const crear = spyOn(usuariosRepository, 'crear');
    crear.mockImplementation(async (nuevo) =>
      filaUsuario({ ...nuevo, id: 'u-2' })
    );

    const resultado = await registroService.sincronizarDesdeClerk(SESION, {
      nombre: `  ${'n'.repeat(200)}  `,
      rol: 'Afiliado',
    });

    expect(crear).toHaveBeenCalledWith({
      clerkId: 'clerk-1',
      nombre: 'n'.repeat(120),
      email: 'ana@ejemplo.com',
      passwordHash: null,
      rol: 'afiliado',
    });
    expect(resultado.creado).toBe(true);
    expect(resultado.usuario.rol).toBe('afiliado');
  });

  test('sin nombres usa Usuario y rol cliente por defecto', async () => {
    spyOn(usuariosRepository, 'buscarPorClerkId').mockResolvedValue(null);
    const crear = spyOn(usuariosRepository, 'crear');
    crear.mockImplementation(async (nuevo) =>
      filaUsuario({ ...nuevo, id: 'u-3' })
    );

    await registroService.sincronizarDesdeClerk(
      { ...SESION, nombre: '   ' },
      {}
    );

    expect(crear).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'Usuario', rol: 'cliente' })
    );
  });

  test('carrera con email duplicado reporta 409', async () => {
    spyOn(usuariosRepository, 'buscarPorClerkId').mockResolvedValue(null);
    spyOn(usuariosRepository, 'crear').mockRejectedValue({ code: '23505' });

    await expect(
      registroService.sincronizarDesdeClerk(SESION, {})
    ).rejects.toBeInstanceOf(ConflictError);
  });

  test('otro error de BD se propaga sin traducir', async () => {
    spyOn(usuariosRepository, 'buscarPorClerkId').mockResolvedValue(null);
    spyOn(usuariosRepository, 'crear').mockRejectedValue(new Error('caída'));

    await expect(
      registroService.sincronizarDesdeClerk(SESION, {})
    ).rejects.toThrow('caída');
  });
});

describe('registroService.registrarUsuario (legacy)', () => {
  test('duplicado explícito devuelve 409 sin hashear', async () => {
    spyOn(usuariosRepository, 'buscarPorEmail').mockResolvedValue(
      filaUsuario()
    );

    await expect(
      registroService.registrarUsuario({
        nombre: 'Ana',
        email: 'ANA@ejemplo.com',
        password: 'Secreta123',
      })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  test('normaliza el email y guarda hash, no la clave', async () => {
    spyOn(usuariosRepository, 'buscarPorEmail').mockResolvedValue(null);
    const crear = spyOn(usuariosRepository, 'crear');
    crear.mockImplementation(async (nuevo) =>
      filaUsuario({ ...nuevo, id: 'u-4' })
    );

    const resultado = await registroService.registrarUsuario({
      nombre: '  Ana  ',
      email: 'ANA@Ejemplo.COM',
      password: 'Secreta123',
    });

    const guardado = crear.mock.calls[0][0] as { passwordHash: string };
    expect(guardado.passwordHash).not.toBe('Secreta123');
    expect(await Bun.password.verify('Secreta123', guardado.passwordHash)).toBe(
      true
    );
    expect(crear).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'Ana', email: 'ana@ejemplo.com' })
    );
    expect(resultado.email).toBe('ana@ejemplo.com');
    expect(resultado).not.toHaveProperty('passwordHash');
  });

  test('carrera concurrente reporta 409', async () => {
    spyOn(usuariosRepository, 'buscarPorEmail').mockResolvedValue(null);
    spyOn(usuariosRepository, 'crear').mockRejectedValue({ code: '23505' });

    await expect(
      registroService.registrarUsuario({
        nombre: 'Ana',
        email: 'ana@ejemplo.com',
        password: 'Secreta123',
      })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  test('otro error de BD se propaga sin traducir', async () => {
    spyOn(usuariosRepository, 'buscarPorEmail').mockResolvedValue(null);
    spyOn(usuariosRepository, 'crear').mockRejectedValue(new Error('caída'));

    await expect(
      registroService.registrarUsuario({
        nombre: 'Ana',
        email: 'ana@ejemplo.com',
        password: 'Secreta123',
      })
    ).rejects.toThrow('caída');
  });
});
