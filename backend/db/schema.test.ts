/**
 * Los schemas de Drizzle solo se usan para generar migraciones: esta prueba
 * los importa para verificar que cargan y exponen las tablas esperadas.
 */
import { describe, expect, test } from 'bun:test';
import { getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import * as schema from './schema';

describe('schema de Drizzle', () => {
  test('expone las tablas de usuarios, disponibilidad y tareas', () => {
    // Given: el schema que reexporta las tres tablas
    // When: se lee el nombre de cada tabla
    // Then: son usuarios, disponibilidad y tareas
    expect(getTableName(schema.usuarios)).toBe('usuarios');
    expect(getTableName(schema.disponibilidad)).toBe('disponibilidad');
    expect(getTableName(schema.tareas)).toBe('tareas');
  });

  test('disponibilidad declara sus restricciones e índices', () => {
    // Given: la tabla disponibilidad
    // When: se lee su configuración
    const config = getTableConfig(schema.disponibilidad);
    // Then: declara su nombre y al menos una restricción o índice
    expect(config.name).toBe('disponibilidad');
    expect(
      config.uniqueConstraints.length +
        config.indexes.length +
        config.checks.length
    ).toBeGreaterThan(0);
  });
});
