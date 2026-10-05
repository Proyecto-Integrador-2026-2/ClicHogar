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
    expect(validarCampoTarea('titulo', VALIDA)).toBeUndefined();
    expect(validarCampoTarea('descripcion', VALIDA)).toBeUndefined();
    expect(validarCampoTarea('categoria', VALIDA)).toBeUndefined();
    expect(validarCampoTarea('ubicacion', VALIDA)).toBeUndefined();
  });

  test('campos vacíos son obligatorios (Escenario 3)', () => {
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
    expect(
      validarCampoTarea('descripcion', {
        ...VALIDA,
        descripcion: 'Muy corta',
      })
    ).toBe('Por favor, proporciona más detalles (mínimo 20 caracteres)...');
  });

  test(`descripción acepta hasta ${MAX_DESCRIPCION} (el input la acota)`, () => {
    expect(
      validarCampoTarea('descripcion', {
        ...VALIDA,
        descripcion: 'x'.repeat(MAX_DESCRIPCION),
      })
    ).toBeUndefined();
  });

  test('categoría fuera del vocabulario se rechaza', () => {
    expect(
      validarCampoTarea('categoria', { ...VALIDA, categoria: 'Astronauta' })
    ).toBe('Selecciona una categoría válida.');
    expect(validarCampoTarea('categoria', { ...VALIDA, categoria: '' })).toBe(
      'Selecciona una categoría válida.'
    );
  });

  test('título de más de 120 caracteres se rechaza', () => {
    expect(
      validarCampoTarea('titulo', { ...VALIDA, titulo: 'x'.repeat(121) })
    ).toBe('El título no puede superar 120 caracteres.');
    expect(
      validarCampoTarea('titulo', { ...VALIDA, titulo: 'x'.repeat(120) })
    ).toBeUndefined();
  });
});
