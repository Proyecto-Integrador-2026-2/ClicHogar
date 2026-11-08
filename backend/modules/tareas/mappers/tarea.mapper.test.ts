/**
 * Pruebas del mapper público de tareas (US-008).
 * Puras y sin BD: contrato estable con autor incluido.
 */
import { describe, expect, test } from 'bun:test';
import type { AutorTarea, Tarea } from '../entities/tarea.entity';
import { toDetalleTarea, toTareaPublica } from './tarea.mapper';

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
    // Given: una tarea guardada y el nombre de su autor
    // When: se mapea a su forma pública
    // Then: trae los campos visibles más el autor
    expect(toTareaPublica(TAREA, 'Ana Pérez')).toEqual({
      id: TAREA.id,
      titulo: 'Arreglar grifo',
      descripcion: 'Gotea día y noche sin parar ya.',
      categoria: 'Plomería',
      estado: 'abierta',
      ubicacion: 'Belén',
      latitud: null,
      longitud: null,
      autorId: '11111111-1111-4111-8111-111111111111',
      autorNombre: 'Ana Pérez',
      creadoEn: TAREA.creadoEn,
    });
  });

  test('no expone el usuarioId interno', () => {
    // Given: una tarea que tiene el usuarioId interno
    // When: se mapea a su forma pública
    const publica = toTareaPublica(TAREA, 'Ana Pérez');
    // Then: no se expone `usuarioId` (se expone como `autorId` público)
    expect(publica).not.toHaveProperty('usuarioId');
    expect(publica.autorId).toBe('11111111-1111-4111-8111-111111111111');
  });
});

describe('toDetalleTarea (US-009)', () => {
  const AUTOR: AutorTarea = {
    id: TAREA.usuarioId,
    nombre: 'Ana Pérez',
    descripcion: 'Vivo en Belén.',
    ubicacion: 'Medellín',
    fotoUrl: '/uploads/perfiles/a.jpg',
  };
  const CON_COORDENADAS: Tarea = {
    ...TAREA,
    latitud: 6.244203,
    longitud: -75.581211,
  };

  test('incluye autor y banderas', () => {
    // Given: una tarea ajena abierta y su autor
    // When: se arma el detalle para un afiliado
    const detalle = toDetalleTarea(TAREA, AUTOR, {
      esPropia: false,
      puedeOfertar: true,
      yaPostulado: false,
    });
    // Then: trae la tarea pública, el autor y las banderas
    expect(detalle).toMatchObject({
      id: TAREA.id,
      titulo: 'Arreglar grifo',
      autorNombre: 'Ana Pérez',
      autor: AUTOR,
      esPropia: false,
      puedeOfertar: true,
      yaPostulado: false,
    });
  });

  test('un tercero ve la ubicación aproximada (2 decimales)', () => {
    // Given: una tarea con coordenadas exactas
    // When: la ve alguien que no es su autor
    const detalle = toDetalleTarea(CON_COORDENADAS, AUTOR, {
      esPropia: false,
      puedeOfertar: true,
      yaPostulado: false,
    });
    // Then: las coordenadas se redondean a ~1 km
    expect(detalle.latitud).toBe(6.24);
    expect(detalle.longitud).toBe(-75.58);
  });

  test('el autor ve el punto exacto', () => {
    // Given: una tarea con coordenadas exactas
    // When: la ve su autor
    const detalle = toDetalleTarea(CON_COORDENADAS, AUTOR, {
      esPropia: true,
      puedeOfertar: false,
      yaPostulado: false,
    });
    // Then: las coordenadas no se alteran
    expect(detalle.latitud).toBe(6.244203);
    expect(detalle.longitud).toBe(-75.581211);
  });

  test('sin coordenadas no inventa ninguna', () => {
    // Given: una tarea sin coordenadas
    // When: la ve un tercero
    const detalle = toDetalleTarea(TAREA, AUTOR, {
      esPropia: false,
      puedeOfertar: true,
      yaPostulado: false,
    });
    // Then: siguen en null
    expect(detalle.latitud).toBeNull();
    expect(detalle.longitud).toBeNull();
  });
});
