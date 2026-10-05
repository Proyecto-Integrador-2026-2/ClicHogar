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
import { normalizarTarea, tareasService } from './tareas.service';

const VALIDA = {
  titulo: 'Arreglar grifo que gotea',
  descripcion: 'El grifo de la cocina gotea día y noche y ya manchó el mueble.',
  categoria: 'Plomería',
  ubicacion: 'Belén, Medellín',
};

describe('normalizarTarea', () => {
  test('acepta una solicitud válida y recorta espacios', () => {
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
    expect(() => normalizarTarea({ ...VALIDA, titulo: '   ' })).toThrow(
      ValidationError
    );
  });

  test('rechaza descripción corta o larga (Escenario 5)', () => {
    expect(() =>
      normalizarTarea({ ...VALIDA, descripcion: 'Muy corta' })
    ).toThrow('Por favor, proporciona más detalles (mínimo 20 caracteres)...');
    expect(() =>
      normalizarTarea({ ...VALIDA, descripcion: 'x'.repeat(1001) })
    ).toThrow(ValidationError);
  });

  test('rechaza categoría fuera del vocabulario', () => {
    expect(() =>
      normalizarTarea({ ...VALIDA, categoria: 'Astronauta' })
    ).toThrow('La categoría no es válida.');
  });

  test('rechaza ubicación vacía (Escenario 3)', () => {
    expect(() => normalizarTarea({ ...VALIDA, ubicacion: '' })).toThrow(
      ValidationError
    );
  });

  test('acepta coordenadas válidas y rechaza fuera de rango', () => {
    expect(
      normalizarTarea({ ...VALIDA, latitud: 6.25, longitud: -75.59 })
    ).toMatchObject({ latitud: 6.25, longitud: -75.59 });
    expect(() =>
      normalizarTarea({ ...VALIDA, latitud: 200, longitud: 0 })
    ).toThrow(ValidationError);
  });

  test('el estado inicial es abierta (#118)', () => {
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
    spyOn(usuariosRepository, 'buscarPorClerkId').mockResolvedValue(null);
    await expect(
      tareasService.crearTarea('clerk-x', VALIDA)
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test('crearTarea fija estado abierta y nombra al autor', async () => {
    spyOn(usuariosRepository, 'buscarPorClerkId').mockResolvedValue(autor);
    const crear = spyOn(tareasRepository, 'crear');
    crear.mockImplementation(async (nueva) => ({
      id: 't-1',
      ...nueva,
      creadoEn: new Date('2026-02-01T00:00:00.000Z'),
      actualizadoEn: new Date('2026-02-01T00:00:00.000Z'),
    }));

    const resultado = await tareasService.crearTarea('clerk-1', VALIDA);

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

    const resultado = await tareasService.listarAbiertas();

    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toMatchObject({
      id: 't-7',
      autorNombre: 'Luis',
      estado: 'abierta',
    });
  });
});
