/**
 * Pruebas de publicación de tareas (US-006, Esc 3-5).
 * Puras y sin BD: validan que lo corrupto se rechaza y lo válido se
 * normaliza (el INSERT se verifica en E2E contra Neon).
 */
import { describe, expect, test } from 'bun:test';
import { ValidationError } from '../../../shared/errors/app-error';
import { ESTADO_INICIAL_TAREA } from '../categorias';
import { normalizarTarea } from './tareas.service';

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
