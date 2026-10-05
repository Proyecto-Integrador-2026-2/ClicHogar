/**
 * Pruebas del mapper público de tareas (US-008).
 * Puras y sin BD: contrato estable con autor incluido.
 */
import { describe, expect, test } from 'bun:test';
import type { Tarea } from '../entities/tarea.entity';
import { toTareaPublica } from './tarea.mapper';

const TAREA: Tarea = {
  id: '22222222-2222-4222-8222-222222222222',
  usuarioId: '11111111-1111-4111-8111-111111111111',
  titulo: 'Arreglar grifo',
  descripcion: 'Gotea día y noche sin parar ya.',
  categoria: 'Plomería',
  estado: 'abierta',
  ubicacion: 'Belén',
  latitud: null,
  longitud: null,
  creadoEn: new Date('2026-01-15T10:00:00.000Z'),
  actualizadoEn: new Date('2026-01-15T10:00:00.000Z'),
};

describe('toTareaPublica', () => {
  test('mapea todos los campos visibles más el autor', () => {
    expect(toTareaPublica(TAREA, 'Ana Pérez')).toEqual({
      id: TAREA.id,
      titulo: 'Arreglar grifo',
      descripcion: 'Gotea día y noche sin parar ya.',
      categoria: 'Plomería',
      estado: 'abierta',
      ubicacion: 'Belén',
      latitud: null,
      longitud: null,
      autorNombre: 'Ana Pérez',
      creadoEn: TAREA.creadoEn,
    });
  });

  test('no expone el usuarioId interno', () => {
    const publica = toTareaPublica(TAREA, 'Ana Pérez');
    expect(publica).not.toHaveProperty('usuarioId');
    expect(JSON.stringify(publica)).not.toContain(
      '11111111-1111-4111-8111-111111111111'
    );
  });
});
