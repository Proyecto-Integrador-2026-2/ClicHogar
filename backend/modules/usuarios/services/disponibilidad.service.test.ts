/**
 * Pruebas de disponibilidad (US-005): normalización de la matriz y
 * guardia de rol. Puras y sin BD: la transacción y el repositorio se
 * verifican en E2E contra Neon.
 */
import { describe, expect, test } from 'bun:test';
import {
  ForbiddenError,
  ValidationError,
} from '../../../shared/errors/app-error';
import {
  normalizarSlots,
  verificarRolAfiliado,
} from './disponibilidad.service';

describe('normalizarSlots', () => {
  test('acepta matriz válida y ordena por día y franja', () => {
    // Given: una matriz válida con franjas desordenadas
    // When: se normaliza
    // Then: queda ordenada por día y franja
    expect(
      normalizarSlots([
        { dia: 5, franja: 'noche' },
        { dia: 1, franja: 'tarde' },
        { dia: 1, franja: 'manana' },
      ])
    ).toEqual([
      { diaSemana: 1, franjaHoraria: 'manana' },
      { diaSemana: 1, franjaHoraria: 'tarde' },
      { diaSemana: 5, franjaHoraria: 'noche' },
    ]);
  });

  test('arreglo vacío = limpiar (Escenario 3)', () => {
    // Given: un arreglo vacío
    // When: se normaliza
    // Then: sigue vacío, que significa limpiar
    expect(normalizarSlots([])).toEqual([]);
  });

  test('deduplica sin renegar', () => {
    // Given: la misma franja repetida
    // When: se normaliza
    // Then: queda una sola, sin lanzar error
    expect(
      normalizarSlots([
        { dia: 2, franja: 'tarde' },
        { dia: 2, franja: 'tarde' },
      ])
    ).toEqual([{ diaSemana: 2, franjaHoraria: 'tarde' }]);
  });

  test('rechaza día fuera de 0-6', () => {
    // Given: un día 7 y otro 1.5
    // When: se normaliza cada uno
    // Then: ambos lanzan ValidationError
    expect(() => normalizarSlots([{ dia: 7, franja: 'tarde' }])).toThrow(
      ValidationError
    );
    expect(() => normalizarSlots([{ dia: 1.5, franja: 'tarde' }])).toThrow(
      ValidationError
    );
  });

  test('rechaza franja desconocida', () => {
    // Given: una franja 'madrugada' que no existe
    // When: se normaliza
    // Then: lanza ValidationError
    expect(() => normalizarSlots([{ dia: 1, franja: 'madrugada' }])).toThrow(
      ValidationError
    );
  });

  test('rechaza lo que no sea arreglo', () => {
    // Given: un texto y null en lugar de un arreglo
    // When: se normaliza cada uno
    // Then: ambos lanzan ValidationError
    expect(() => normalizarSlots('manana')).toThrow(ValidationError);
    expect(() => normalizarSlots(null)).toThrow(ValidationError);
  });

  test('rechaza items sin forma de horario', () => {
    // Given: elementos que no tienen día y franja
    // When: se normaliza cada uno
    // Then: lanza el mensaje de horario incompleto
    expect(() => normalizarSlots([null])).toThrow(
      'Cada horario debe tener día y franja.'
    );
    expect(() => normalizarSlots(['tarde'])).toThrow(
      'Cada horario debe tener día y franja.'
    );
  });
});

describe('verificarRolAfiliado', () => {
  test('afiliado pasa (Escenario 4 negativo)', () => {
    // Given: el rol afiliado
    // When: se verifica el rol
    // Then: no lanza ningún error
    expect(() => verificarRolAfiliado('afiliado')).not.toThrow();
  });

  test('cliente recibe 403 con el mensaje de exclusividad', () => {
    // Given: el rol cliente
    // When: se verifica el rol
    // Then: lanza ForbiddenError con status 403 y el mensaje de exclusividad para Afiliados
    try {
      verificarRolAfiliado('cliente');
      expect.unreachable('debió lanzar ForbiddenError');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenError);
      expect((error as ForbiddenError).status).toBe(403);
      expect((error as ForbiddenError).message).toContain('Afiliados');
    }
  });
});
