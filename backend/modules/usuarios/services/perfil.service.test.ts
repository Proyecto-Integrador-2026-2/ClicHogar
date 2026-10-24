/**
 * Pruebas del servicio de perfil (US-004): normalización pura del patch
 * y actualización con repositorio simulado (sin Postgres). La foto usa
 * un almacenamiento falso inyectado; el disco real no se toca.
 */
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import {
  NotFoundError,
  ValidationError,
} from '../../../shared/errors/app-error';
import type { Usuario } from '../entities/usuario.entity';
import { MAX_FOTO_BYTES } from '../storage/almacenamiento';
import { usuariosRepository } from '../repositories/usuarios.repository';
import { normalizarPatch, perfilService } from './perfil.service';

afterEach(() => {
  mock.restore();
});

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

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

describe('normalizarPatch', () => {
  test('ausente = no tocar', () => {
    // Given: un patch vacío
    // When: se normaliza
    // Then: sigue vacío: lo ausente no se toca
    expect(normalizarPatch({})).toEqual({});
  });

  test('recorta y acota a 500/120', () => {
    // Given: una descripción de 600 y una ubicación de 200 caracteres, con espacios
    // When: se normaliza
    // Then: se recortan los espacios y se acotan a 500 y 120
    expect(
      normalizarPatch({
        descripcion: `  ${'d'.repeat(600)}  `,
        ubicacion: `  ${'u'.repeat(200)}  `,
      })
    ).toEqual({
      descripcion: 'd'.repeat(500),
      ubicacion: 'u'.repeat(120),
    });
  });
});

describe('perfilService.actualizarPerfil', () => {
  test('404 sin perfil local sincronizado', async () => {
    // Given: un clerkId sin perfil local
    spyOn(usuariosRepository, 'buscarPorClerkId').mockResolvedValue(null);
    // When: se actualiza el perfil
    // Then: falla con NotFoundError
    await expect(
      perfilService.actualizarPerfil({ clerkId: 'clerk-x' })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test('persiste solo lo recibido y devuelve lo público', async () => {
    // Given: un usuario existente y un repositorio que aplica el patch
    const existente = filaUsuario();
    const buscar = spyOn(usuariosRepository, 'buscarPorClerkId');
    buscar.mockResolvedValue(existente);
    const actualizar = spyOn(usuariosRepository, 'actualizarParcial');
    actualizar.mockImplementation(async (_id, patch) => ({
      ...existente,
      ...patch,
    }));

    // When: se actualiza solo la descripción, con espacios
    const resultado = await perfilService.actualizarPerfil({
      clerkId: 'clerk-1',
      descripcion: '  Plomera con 5 años  ',
    });

    // Then: persiste solo lo recibido y devuelve la forma pública sin el hash
    expect(actualizar).toHaveBeenCalledWith(existente.id, {
      descripcion: 'Plomera con 5 años',
    });
    expect(resultado).toEqual({
      id: 'u-1',
      nombre: 'Ana',
      email: 'ana@ejemplo.com',
      rol: 'cliente',
      fotoUrl: null,
      descripcion: 'Plomera con 5 años',
      ubicacion: null,
      creadoEn: existente.creadoEn,
    });
    expect(resultado).not.toHaveProperty('passwordHash');
  });

  test('guarda la foto con el almacenamiento inyectado', async () => {
    const existente = filaUsuario();
    spyOn(usuariosRepository, 'buscarPorClerkId').mockResolvedValue(existente);
    spyOn(usuariosRepository, 'actualizarParcial').mockImplementation(
      async (_id, patch) => ({ ...existente, ...patch })
    );
    // Given: un almacenamiento falso que devuelve una URL
    const falsoAlmacenamiento = {
      guardar: async () => ({ url: '/uploads/perfiles/falsa.jpg' }),
    };

    // When: se actualiza el perfil con una foto PNG
    const resultado = await perfilService.actualizarPerfil({
      clerkId: 'clerk-1',
      foto: { datos: PNG, mimeDeclarado: 'image/png', tamano: PNG.length },
      almacenamiento: falsoAlmacenamiento,
    });

    // Then: la foto se guarda con el almacenamiento inyectado
    expect(resultado.fotoUrl).toBe('/uploads/perfiles/falsa.jpg');
  });

  test('rechaza foto pesada o con bytes inválidos', async () => {
    spyOn(usuariosRepository, 'buscarPorClerkId').mockResolvedValue(
      filaUsuario()
    );
    // Given: una foto de más de 5 MB y otra con bytes que no son JPG ni PNG
    const falsoAlmacenamiento = {
      guardar: async () => ({ url: '/uploads/perfiles/falsa.jpg' }),
    };

    // When: se actualiza el perfil con la foto pesada
    // Then: falla con ValidationError
    await expect(
      perfilService.actualizarPerfil({
        clerkId: 'clerk-1',
        foto: {
          datos: PNG,
          mimeDeclarado: 'image/png',
          tamano: MAX_FOTO_BYTES + 1,
        },
        almacenamiento: falsoAlmacenamiento,
      })
    ).rejects.toBeInstanceOf(ValidationError);

    // When: se actualiza el perfil con los bytes inválidos
    // Then: falla con el mensaje de formato no permitido
    await expect(
      perfilService.actualizarPerfil({
        clerkId: 'clerk-1',
        foto: {
          datos: new Uint8Array([0x00, 0x01, 0x02]),
          mimeDeclarado: 'image/jpeg',
          tamano: 3,
        },
        almacenamiento: falsoAlmacenamiento,
      })
    ).rejects.toThrow('JPG o PNG');
  });
});
