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
    expect(claveSlot(1, 'manana')).toBe('1:manana');
  });
});

describe('alternarSlot', () => {
  test('agrega si falta y quita si existe', () => {
    const vacio = new Set<string>();
    const conUno = alternarSlot(vacio, 1, 'manana');
    expect(conUno.has('1:manana')).toBe(true);
    expect(alternarSlot(conUno, 1, 'manana').has('1:manana')).toBe(false);
  });

  test('no muta el conjunto recibido', () => {
    const original = new Set<string>(['2:tarde']);
    alternarSlot(original, 3, 'noche');
    expect(original).toEqual(new Set(['2:tarde']));
  });
});

describe('slotsAArreglo', () => {
  test('ordena por día y franja para el PUT', () => {
    expect(slotsAArreglo(new Set(['5:noche', '1:tarde', '1:manana']))).toEqual([
      { dia: 1, franja: 'manana' },
      { dia: 1, franja: 'tarde' },
      { dia: 5, franja: 'noche' },
    ]);
  });

  test('conjunto vacío produce arreglo vacío (limpiar)', () => {
    expect(slotsAArreglo(new Set())).toEqual([]);
  });
});
