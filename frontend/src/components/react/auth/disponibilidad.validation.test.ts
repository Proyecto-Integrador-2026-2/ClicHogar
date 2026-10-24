/**
 * Pruebas de los helpers de la matriz de disponibilidad (US-005).
 * Puras y sin red: toggle inmutable, claves estables y orden de envío.
 */
import { describe, expect, test } from 'bun:test';
import {
  alternarSlot,
  claveSlot,
  slotsAArreglo,
} from './disponibilidad.validation';

describe('claveSlot', () => {
  test('compone día y franja', () => {
    // Given: el día 1 y la franja 'manana'
    // When: se compone la clave
    // Then: es '1:manana'
    expect(claveSlot(1, 'manana')).toBe('1:manana');
  });
});

describe('alternarSlot', () => {
  test('agrega si falta y quita si existe', () => {
    // Given: un conjunto vacío
    const vacio = new Set<string>();
    // When: se alterna una franja que falta
    const conUno = alternarSlot(vacio, 1, 'manana');
    // Then: se agrega; al alternarla otra vez se quita
    expect(conUno.has('1:manana')).toBe(true);
    expect(alternarSlot(conUno, 1, 'manana').has('1:manana')).toBe(false);
  });

  test('no muta el conjunto recibido', () => {
    // Given: un conjunto con una franja
    const original = new Set<string>(['2:tarde']);
    // When: se alterna otra franja
    alternarSlot(original, 3, 'noche');
    // Then: el conjunto original queda intacto
    expect(original).toEqual(new Set(['2:tarde']));
  });
});

describe('slotsAArreglo', () => {
  test('ordena por día y franja para el PUT', () => {
    // Given: claves desordenadas de tres franjas
    // When: se convierte a arreglo para el PUT
    // Then: queda ordenado por día y franja
    expect(slotsAArreglo(new Set(['5:noche', '1:tarde', '1:manana']))).toEqual([
      { dia: 1, franja: 'manana' },
      { dia: 1, franja: 'tarde' },
      { dia: 5, franja: 'noche' },
    ]);
  });

  test('conjunto vacío produce arreglo vacío (limpiar)', () => {
    // Given: un conjunto vacío
    // When: se convierte a arreglo
    // Then: el arreglo vacío significa limpiar
    expect(slotsAArreglo(new Set())).toEqual([]);
  });
});
