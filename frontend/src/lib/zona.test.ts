/**
 * Pruebas puras de las utilidades del filtro por zona: radio, lectura de la
 * URL, serialización, distancia Haversine y formato de distancia.
 */
import { describe, expect, test } from 'bun:test';
import {
  distanciaKm,
  formatearDistancia,
  leerFiltroZona,
  queryZona,
  validarRadio,
} from './zona';

describe('validarRadio', () => {
  test('vacío usa el valor por defecto de 2 km', () => {
    expect(validarRadio('')).toBe(2);
    expect(validarRadio('   ')).toBe(2);
  });

  test('acepta enteros entre 1 y 100', () => {
    expect(validarRadio('1')).toBe(1);
    expect(validarRadio('100')).toBe(100);
  });

  test('rechaza cero, fuera de rango, decimales, texto y negativos', () => {
    expect(validarRadio('0')).toBeNull();
    expect(validarRadio('101')).toBeNull();
    expect(validarRadio('2.5')).toBeNull();
    expect(validarRadio('abc')).toBeNull();
    expect(validarRadio('-1')).toBeNull();
  });
});

describe('leerFiltroZona', () => {
  test('lee los tres parámetros válidos', () => {
    expect(leerFiltroZona('?lat=6.2442&lng=-75.5812&radio=5')).toEqual({
      lat: 6.2442,
      lng: -75.5812,
      radio: 5,
    });
  });

  test('radio vacío se convierte en 2', () => {
    expect(leerFiltroZona('?lat=6.2&lng=-75.5&radio=')).toEqual({
      lat: 6.2,
      lng: -75.5,
      radio: 2,
    });
  });

  test('si falta un parámetro no hay filtro', () => {
    expect(leerFiltroZona('?lat=6.2&lng=-75.5')).toBeNull();
    expect(leerFiltroZona('?lat=6.2&radio=5')).toBeNull();
    expect(leerFiltroZona('?lng=-75.5&radio=5')).toBeNull();
    expect(leerFiltroZona('')).toBeNull();
  });

  test('rechaza coordenadas fuera de rango y radio inválido', () => {
    expect(leerFiltroZona('?lat=91&lng=-75.5&radio=5')).toBeNull();
    expect(leerFiltroZona('?lat=6.2&lng=181&radio=5')).toBeNull();
    expect(leerFiltroZona('?lat=6.2&lng=-75.5&radio=0')).toBeNull();
  });

  test('ignora parámetros extra', () => {
    expect(leerFiltroZona('?lat=6.2&lng=-75.5&radio=5&otro=1')).toEqual({
      lat: 6.2,
      lng: -75.5,
      radio: 5,
    });
  });
});

describe('queryZona', () => {
  test('serializa los tres parámetros', () => {
    expect(queryZona({ lat: 6.2442, lng: -75.5812, radio: 5 })).toBe(
      'lat=6.2442&lng=-75.5812&radio=5'
    );
  });

  test('sin filtro devuelve cadena vacía', () => {
    expect(queryZona(null)).toBe('');
  });
});

describe('distanciaKm', () => {
  test('el mismo punto da 0', () => {
    expect(
      distanciaKm({ lat: 6.2442, lng: -75.5812 }, { lat: 6.2442, lng: -75.5812 })
    ).toBe(0);
  });

  test('un grado de latitud ronda 111 km', () => {
    const km = distanciaKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(km).toBeGreaterThan(111);
    expect(km).toBeLessThan(112);
  });

  test('Medellín–Envigado es una distancia corta y positiva', () => {
    const km = distanciaKm(
      { lat: 6.2442, lng: -75.5812 },
      { lat: 6.1759, lng: -75.5917 }
    );
    expect(km).toBeGreaterThan(5);
    expect(km).toBeLessThan(10);
  });
});

describe('formatearDistancia', () => {
  test('menos de 1 km usa metros a la decena', () => {
    expect(formatearDistancia(0.85)).toBe('a 850 m');
  });

  test('menos de 10 km usa un decimal con coma', () => {
    expect(formatearDistancia(2.34)).toBe('a 2,3 km');
  });

  test('10 km o más usa entero', () => {
    expect(formatearDistancia(12.6)).toBe('a 13 km');
  });
});
