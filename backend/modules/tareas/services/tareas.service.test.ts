/**
 * Pruebas de publicación de tareas (US-006, Esc 3-5).
 * Puras y sin BD: validan que lo corrupto se rechaza y lo válido se
 * normaliza (el INSERT se verifica en E2E contra Neon).
 */
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import {
  NotFoundError,
  ValidationError,
} from '../../../shared/errors/app-error';
import { ESTADO_INICIAL_TAREA } from '../categorias';
import type { Tarea } from '../entities/tarea.entity';
import { usuariosRepository } from '../../usuarios/repositories/usuarios.repository';
import type { Usuario } from '../../usuarios/entities/usuario.entity';
import { tareasRepository } from '../repositories/tareas.repository';
import { normalizarTarea } from '../validators/tarea.validator';
import { tareasService } from './tareas.service';

const VALIDA = {
  titulo: 'Arreglar grifo que gotea',
  descripcion: 'El grifo de la cocina gotea día y noche y ya manchó el mueble.',
  categoria: 'Plomería',
  ubicacion: 'Belén, Medellín',
};

describe('normalizarTarea', () => {
  test('acepta una solicitud válida y recorta espacios', () => {
    // Given: una solicitud válida con el título rodeado de espacios
    // When: se normaliza
    // Then: el título queda recortado y las coordenadas en null
    expect(
      normalizarTarea({ ...VALIDA, titulo: '  Arreglar grifo  ' })
    ).toEqual({
      titulo: 'Arreglar grifo',
      descripcion: VALIDA.descripcion,
      categoria: 'Plomería',
      ubicacion: 'Belén, Medellín',
      latitud: null,
      longitud: null,
    });
  });

  test('rechaza título vacío (Escenario 3)', () => {
    // Given: un título compuesto solo de espacios
    // When: se normaliza la solicitud
    // Then: lanza ValidationError
    expect(() => normalizarTarea({ ...VALIDA, titulo: '   ' })).toThrow(
      ValidationError
    );
  });

  test('rechaza descripción corta o larga (Escenario 5)', () => {
    // Given: una descripción de 9 caracteres y otra de 1001
    // When: se normaliza cada una
    // Then: ambas se rechazan con ValidationError
    expect(() =>
      normalizarTarea({ ...VALIDA, descripcion: 'Muy corta' })
    ).toThrow('Por favor, proporciona más detalles (mínimo 20 caracteres)...');
    expect(() =>
      normalizarTarea({ ...VALIDA, descripcion: 'x'.repeat(1001) })
    ).toThrow(ValidationError);
  });

  test('rechaza categoría fuera del vocabulario', () => {
    // Given: una categoría que no existe en el vocabulario
    // When: se normaliza la solicitud
    // Then: lanza el mensaje de categoría no válida
    expect(() =>
      normalizarTarea({ ...VALIDA, categoria: 'Astronauta' })
    ).toThrow('La categoría no es válida.');
  });

  test('rechaza ubicación vacía (Escenario 3)', () => {
    // Given: una ubicación vacía
    // When: se normaliza la solicitud
    // Then: lanza ValidationError
    expect(() => normalizarTarea({ ...VALIDA, ubicacion: '' })).toThrow(
      ValidationError
    );
  });

  test('acepta coordenadas válidas y rechaza fuera de rango', () => {
    // Given: coordenadas válidas y otras fuera de rango
    // When: se normaliza cada solicitud
    // Then: las válidas se aceptan y las fuera de rango lanzan ValidationError
    expect(
      normalizarTarea({ ...VALIDA, latitud: 6.25, longitud: -75.59 })
    ).toMatchObject({ latitud: 6.25, longitud: -75.59 });
    expect(() =>
      normalizarTarea({ ...VALIDA, latitud: 200, longitud: 0 })
    ).toThrow(ValidationError);
  });

  test('el estado inicial es abierta (#118)', () => {
    // Given: la constante del estado inicial de una tarea
    // When: se lee su valor
    // Then: es 'abierta'
    expect(ESTADO_INICIAL_TAREA).toBe('abierta');
  });
});

describe('tareasService con repositorios simulados (sin Postgres)', () => {
  afterEach(() => {
    mock.restore();
  });

  const autor: Usuario = {
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
  };

  test('crearTarea exige perfil local (404)', async () => {
    // Given: un clerkId sin perfil local en la base
    spyOn(usuariosRepository, 'buscarPorClerkId').mockResolvedValue(null);
    // When: se intenta crear una tarea
    // Then: falla con NotFoundError
    await expect(
      tareasService.crearTarea('clerk-x', VALIDA)
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test('crearTarea fija estado abierta y nombra al autor', async () => {
    // Given: un autor existente y un repositorio que guarda lo recibido
    spyOn(usuariosRepository, 'buscarPorClerkId').mockResolvedValue(autor);
    const crear = spyOn(tareasRepository, 'crear');
    crear.mockImplementation(async (nueva) => ({
      id: 't-1',
      ...nueva,
      creadoEn: new Date('2026-02-01T00:00:00.000Z'),
      actualizadoEn: new Date('2026-02-01T00:00:00.000Z'),
    }));

    // When: se crea la tarea
    const resultado = await tareasService.crearTarea('clerk-1', VALIDA);

    // Then: se guarda con estado 'abierta' y el resultado nombra al autor
    expect(crear).toHaveBeenCalledWith({
      usuarioId: 'u-1',
      titulo: VALIDA.titulo,
      descripcion: VALIDA.descripcion,
      categoria: 'Plomería',
      ubicacion: VALIDA.ubicacion,
      latitud: null,
      longitud: null,
      estado: 'abierta',
    });
    expect(resultado.estado).toBe('abierta');
    expect(resultado.autorNombre).toBe('Ana');
  });

  test('listarAbiertas mapea filas a forma pública', async () => {
    // Given: un repositorio con una tarea abierta de Luis
    const tarea: Tarea = {
      id: 't-7',
      usuarioId: 'u-2',
      titulo: 'Pintar sala',
      descripcion: 'Dos manos de pintura blanca en sala-comedor.',
      categoria: 'Pintura',
      estado: 'abierta',
      ubicacion: 'Chapinero',
      latitud: null,
      longitud: null,
      creadoEn: new Date('2026-02-01T00:00:00.000Z'),
      actualizadoEn: new Date('2026-02-01T00:00:00.000Z'),
    };
    spyOn(tareasRepository, 'listarAbiertas').mockResolvedValue([
      { tarea, autorNombre: 'Luis' },
    ]);

    // When: se listan las abiertas
    const resultado = await tareasService.listarAbiertas();

    // Then: llega una tarea en forma pública con su autor
    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toMatchObject({
      id: 't-7',
      autorNombre: 'Luis',
      estado: 'abierta',
    });
  });
});
