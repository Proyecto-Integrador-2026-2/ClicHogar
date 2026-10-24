/**
 * Pruebas de guardar/obtener disponibilidad (US-005) con repositorios
 * simulados (sin Postgres). La normalización pura y la guardia de rol
 * ya se cubren en `disponibilidad.service.test.ts`.
 */
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../shared/errors/app-error';
import type { Usuario } from '../entities/usuario.entity';
import { disponibilidadRepository } from '../repositories/disponibilidad.repository';
import { usuariosRepository } from '../repositories/usuarios.repository';
import { disponibilidadService } from './disponibilidad.service';

afterEach(() => {
  mock.restore();
});

function filaAfiliado(cambios: Partial<Usuario> = {}): Usuario {
  return {
    id: 'u-9',
    clerkId: 'clerk-9',
    nombre: 'José',
    email: 'jose@ejemplo.com',
    passwordHash: null,
    rol: 'afiliado',
    fotoUrl: null,
    descripcion: null,
    ubicacion: null,
    activo: true,
    creadoEn: new Date('2026-01-01T00:00:00.000Z'),
    actualizadoEn: new Date('2026-01-01T00:00:00.000Z'),
    ...cambios,
  };
}

describe('disponibilidadService.guardar', () => {
  test('404 sin perfil local', async () => {
    // Given: un clerkId sin perfil local
    spyOn(usuariosRepository, 'buscarPorClerkId').mockResolvedValue(null);
    // When: se guarda la disponibilidad
    // Then: falla con NotFoundError
    await expect(
      disponibilidadService.guardar('clerk-x', [])
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test('403 con rol cliente', async () => {
    // Given: un usuario con rol cliente
    spyOn(usuariosRepository, 'buscarPorClerkId').mockResolvedValue(
      filaAfiliado({ rol: 'cliente' })
    );
    // When: se guarda la disponibilidad
    // Then: falla con ForbiddenError
    await expect(
      disponibilidadService.guardar('clerk-9', [{ dia: 1, franja: 'tarde' }])
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('400 con slots inválidos', async () => {
    // Given: un afiliado y un día fuera de rango (9)
    spyOn(usuariosRepository, 'buscarPorClerkId').mockResolvedValue(
      filaAfiliado()
    );
    // When: se guarda la disponibilidad
    // Then: falla con ValidationError
    await expect(
      disponibilidadService.guardar('clerk-9', [{ dia: 9, franja: 'tarde' }])
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test('reemplaza la matriz normalizada del afiliado', async () => {
    // Given: un afiliado y dos franjas desordenadas
    spyOn(usuariosRepository, 'buscarPorClerkId').mockResolvedValue(
      filaAfiliado()
    );
    const reemplazar = spyOn(disponibilidadRepository, 'reemplazar');
    reemplazar.mockImplementation(async (_id, slots) => slots);

    // When: se guarda la disponibilidad
    const resultado = await disponibilidadService.guardar('clerk-9', [
      { dia: 5, franja: 'noche' },
      { dia: 1, franja: 'tarde' },
    ]);

    // Then: se reemplaza con la matriz normalizada y ordenada
    expect(reemplazar).toHaveBeenCalledWith('u-9', [
      { diaSemana: 1, franjaHoraria: 'tarde' },
      { diaSemana: 5, franjaHoraria: 'noche' },
    ]);
    expect(resultado).toEqual([
      { diaSemana: 1, franjaHoraria: 'tarde' },
      { diaSemana: 5, franjaHoraria: 'noche' },
    ]);
  });
});

describe('disponibilidadService.obtener', () => {
  test('404 sin perfil local', async () => {
    // Given: un clerkId sin perfil local
    spyOn(usuariosRepository, 'buscarPorClerkId').mockResolvedValue(null);
    // When: se lee la disponibilidad
    // Then: falla con NotFoundError
    await expect(
      disponibilidadService.obtener('clerk-x')
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test('devuelve la matriz del usuario', async () => {
    // Given: un afiliado con una franja guardada
    spyOn(usuariosRepository, 'buscarPorClerkId').mockResolvedValue(
      filaAfiliado()
    );
    const slots = [{ diaSemana: 2, franjaHoraria: 'manana' }];
    spyOn(disponibilidadRepository, 'listarPorUsuarioId').mockResolvedValue(
      slots
    );

    // When: se lee la disponibilidad
    // Then: devuelve la matriz del usuario
    await expect(disponibilidadService.obtener('clerk-9')).resolves.toEqual(
      slots
    );
  });
});
