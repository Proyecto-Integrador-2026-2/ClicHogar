/**
 * Pruebas del registro con Clerk (US-001) con repositorio simulado
 * (sin Postgres).
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
    // Given: un usuario que ya existe para esa sesión
    const existente = filaUsuario();
    spyOn(usuariosRepository, 'buscarPorClerkId').mockResolvedValue(existente);
    const crear = spyOn(usuariosRepository, 'crear');

    // When: se sincroniza desde Clerk
    const resultado = await registroService.sincronizarDesdeClerk(SESION, {});

    // Then: devuelve el existente con creado=false y no crea otro
    expect(resultado).toEqual({
      usuario: expect.objectContaining({ id: 'u-1' }),
      creado: false,
    });
    expect(crear).not.toHaveBeenCalled();
  });

  test('crea con rol del body y nombre recortado', async () => {
    // Given: un usuario nuevo, rol 'Afiliado' y un nombre de 200 caracteres con espacios
    spyOn(usuariosRepository, 'buscarPorClerkId').mockResolvedValue(null);
    const crear = spyOn(usuariosRepository, 'crear');
    crear.mockImplementation(async (nuevo) =>
      filaUsuario({ ...nuevo, id: 'u-2' })
    );

    // When: se sincroniza desde Clerk
    const resultado = await registroService.sincronizarDesdeClerk(SESION, {
      nombre: `  ${'n'.repeat(200)}  `,
      rol: 'Afiliado',
    });

    // Then: se crea con el rol del body y el nombre recortado a 120
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
    // Given: un usuario nuevo con el nombre de la sesión en blanco
    spyOn(usuariosRepository, 'buscarPorClerkId').mockResolvedValue(null);
    const crear = spyOn(usuariosRepository, 'crear');
    crear.mockImplementation(async (nuevo) =>
      filaUsuario({ ...nuevo, id: 'u-3' })
    );

    // When: se sincroniza desde Clerk sin rol
    await registroService.sincronizarDesdeClerk(
      { ...SESION, nombre: '   ' },
      {}
    );

    // Then: usa el nombre 'Usuario' y el rol cliente
    expect(crear).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'Usuario', rol: 'cliente' })
    );
  });

  test('carrera con email duplicado reporta 409', async () => {
    spyOn(usuariosRepository, 'buscarPorClerkId').mockResolvedValue(null);
    // Given: un INSERT que falla por email duplicado (23505)
    spyOn(usuariosRepository, 'crear').mockRejectedValue({ code: '23505' });

    // When: se sincroniza desde Clerk
    // Then: falla con ConflictError (409)
    await expect(
      registroService.sincronizarDesdeClerk(SESION, {})
    ).rejects.toBeInstanceOf(ConflictError);
  });

  test('otro error de BD se propaga sin traducir', async () => {
    spyOn(usuariosRepository, 'buscarPorClerkId').mockResolvedValue(null);
    // Given: un INSERT que falla con un error cualquiera
    spyOn(usuariosRepository, 'crear').mockRejectedValue(new Error('caída'));

    // When: se sincroniza desde Clerk
    // Then: el error se propaga sin traducir
    await expect(
      registroService.sincronizarDesdeClerk(SESION, {})
    ).rejects.toThrow('caída');
  });
});
