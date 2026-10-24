/**
 * Pruebas de las reglas de validación de publicación (US-006, Esc 3-5).
 * Puras y sin red: vacíos, límites de descripción y vocabulario.
 */
import { describe, expect, test } from 'bun:test';
import {
  MAX_DESCRIPCION,
  MIN_DESCRIPCION,
  validarCampoTarea,
  type ValoresTarea,
} from './tarea.validation';

const VALIDA: ValoresTarea = {
  titulo: 'Arreglar grifo que gotea',
  descripcion: 'El grifo de la cocina gotea día y noche y ya manchó el mueble.',
  categoria: 'Plomería',
  ubicacion: 'Belén, Medellín',
};

describe('validarCampoTarea', () => {
  test('acepta una solicitud válida', () => {
    // Given: una solicitud de tarea válida
    // When: se valida cada campo
    // Then: todos devuelven undefined
    expect(validarCampoTarea('titulo', VALIDA)).toBeUndefined();
    expect(validarCampoTarea('descripcion', VALIDA)).toBeUndefined();
    expect(validarCampoTarea('categoria', VALIDA)).toBeUndefined();
    expect(validarCampoTarea('ubicacion', VALIDA)).toBeUndefined();
  });

  test('campos vacíos son obligatorios (Escenario 3)', () => {
    // Given: un título en blanco, una descripción vacía y una ubicación vacía
    // When: se valida cada campo
    // Then: los tres son obligatorios
    expect(validarCampoTarea('titulo', { ...VALIDA, titulo: '  ' })).toBe(
      'Este campo es obligatorio'
    );
    expect(
      validarCampoTarea('descripcion', { ...VALIDA, descripcion: '' })
    ).toBe('Este campo es obligatorio');
    expect(validarCampoTarea('ubicacion', { ...VALIDA, ubicacion: '' })).toBe(
      'Este campo es obligatorio'
    );
  });

  test(`descripción corta se rechaza (mínimo ${MIN_DESCRIPCION}, Esc 5)`, () => {
    // Given: una descripción de 9 caracteres
    // When: se valida la descripción
    // Then: se rechaza pidiendo mínimo 20 caracteres
    expect(
      validarCampoTarea('descripcion', {
        ...VALIDA,
        descripcion: 'Muy corta',
      })
    ).toBe('Por favor, proporciona más detalles (mínimo 20 caracteres)...');
  });

  test(`descripción acepta hasta ${MAX_DESCRIPCION} (el input la acota)`, () => {
    // Given: una descripción del largo máximo permitido
    // When: se valida la descripción
    // Then: se acepta
    expect(
      validarCampoTarea('descripcion', {
        ...VALIDA,
        descripcion: 'x'.repeat(MAX_DESCRIPCION),
      })
    ).toBeUndefined();
  });

  test('categoría fuera del vocabulario se rechaza', () => {
    // Given: una categoría inexistente y otra vacía
    // When: se valida cada categoría
    // Then: ambas se rechazan
    expect(
      validarCampoTarea('categoria', { ...VALIDA, categoria: 'Astronauta' })
    ).toBe('Selecciona una categoría válida.');
    expect(validarCampoTarea('categoria', { ...VALIDA, categoria: '' })).toBe(
      'Selecciona una categoría válida.'
    );
  });

  test('título de más de 120 caracteres se rechaza', () => {
    // Given: un título de 121 caracteres y otro de 120
    // When: se valida cada título
    // Then: el de 121 se rechaza y el de 120 pasa
    expect(
      validarCampoTarea('titulo', { ...VALIDA, titulo: 'x'.repeat(121) })
    ).toBe('El título no puede superar 120 caracteres.');
    expect(
      validarCampoTarea('titulo', { ...VALIDA, titulo: 'x'.repeat(120) })
    ).toBeUndefined();
  });
});
