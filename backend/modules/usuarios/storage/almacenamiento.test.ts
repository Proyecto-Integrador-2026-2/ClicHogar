/**
 * Pruebas del almacenamiento y normalización del perfil (US-004).
 * Puras y sin BD ni red: número mágico, límites y patch parcial.
 */
import { describe, expect, test } from 'bun:test';
import { MAX_FOTO_BYTES, detectarMimeFoto } from './almacenamiento';
import { normalizarPatch } from '../services/perfil.service';

describe('detectarMimeFoto', () => {
  test('reconoce PNG por cabecera', () => {
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
    ]);
    expect(detectarMimeFoto(png)).toBe('image/png');
  });

  test('reconoce JPEG por cabecera', () => {
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(detectarMimeFoto(jpg)).toBe('image/jpeg');
  });

  test('rechaza un script renombrado (.exe con MZ)', () => {
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
    expect(detectarMimeFoto(exe)).toBeUndefined();
  });

  test('rechaza texto plano y buffers vacíos', () => {
    const txt = new TextEncoder().encode('#!/bin/bash\nevil');
    expect(detectarMimeFoto(txt)).toBeUndefined();
    expect(detectarMimeFoto(new Uint8Array(0))).toBeUndefined();
  });

  test('el límite es 5MB exactos', () => {
    expect(MAX_FOTO_BYTES).toBe(5 * 1024 * 1024);
  });
});

describe('normalizarPatch', () => {
  test('solo incluye los campos presentes (Escenario 2)', () => {
    expect(normalizarPatch({ ubicacion: 'Envigado' })).toEqual({
      ubicacion: 'Envigado',
    });
    expect(normalizarPatch({})).toEqual({});
  });

  test('recorta espacios y acota longitudes', () => {
    expect(
      normalizarPatch({
        descripcion: '  Hola  ',
        ubicacion: 'x'.repeat(200),
      })
    ).toEqual({ descripcion: 'Hola', ubicacion: 'x'.repeat(120) });
  });
});
