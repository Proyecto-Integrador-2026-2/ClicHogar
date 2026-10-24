/**
 * Pruebas del almacenamiento y normalización del perfil (US-004).
 * Puras y sin BD ni red: número mágico, límites y patch parcial.
 */
import { describe, expect, test } from 'bun:test';
import { rm } from 'node:fs/promises';
import {
  MAX_FOTO_BYTES,
  almacenamientoLocal,
  detectarMimeFoto,
} from './almacenamiento';
import { normalizarPatch } from '../services/perfil.service';

describe('detectarMimeFoto', () => {
  test('reconoce PNG por cabecera', () => {
    // Given: bytes con la cabecera mágica de un PNG
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
    ]);
    // When: se detecta el tipo
    // Then: es image/png
    expect(detectarMimeFoto(png)).toBe('image/png');
  });

  test('reconoce JPEG por cabecera', () => {
    // Given: bytes con la cabecera mágica de un JPEG
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    // When: se detecta el tipo
    // Then: es image/jpeg
    expect(detectarMimeFoto(jpg)).toBe('image/jpeg');
  });

  test('rechaza un script renombrado (.exe con MZ)', () => {
    // Given: bytes de un ejecutable renombrado (MZ)
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
    // When: se detecta el tipo
    // Then: no se reconoce como foto
    expect(detectarMimeFoto(exe)).toBeUndefined();
  });

  test('rechaza texto plano y buffers vacíos', () => {
    // Given: un script de texto y un buffer vacío
    const txt = new TextEncoder().encode('#!/bin/bash\nevil');
    // When: se detecta el tipo de cada uno
    // Then: ninguno se reconoce
    expect(detectarMimeFoto(txt)).toBeUndefined();
    expect(detectarMimeFoto(new Uint8Array(0))).toBeUndefined();
  });

  test('el límite es 5MB exactos', () => {
    // Given: la constante del límite de tamaño
    // When: se lee su valor
    // Then: es exactamente 5 MB
    expect(MAX_FOTO_BYTES).toBe(5 * 1024 * 1024);
  });
});

describe('almacenamientoLocal', () => {
  test('guarda el archivo con nombre uuid y devuelve su URL pública', async () => {
    // Given: los bytes de un JPEG
    // When: se guarda con el almacenamiento local
    const foto = await almacenamientoLocal.guardar(
      new Uint8Array([0xff, 0xd8, 0xff]),
      'image/jpeg'
    );
    // Then: la URL es pública con nombre uuid y el archivo existe en disco
    expect(foto.url).toMatch(/^\/uploads\/perfiles\/[0-9a-f-]{36}\.jpg$/);
    const ruta = foto.url.slice(1);
    expect(await Bun.file(ruta).exists()).toBe(true);
    await rm(ruta, { force: true });
  });
});

describe('normalizarPatch', () => {
  test('solo incluye los campos presentes (Escenario 2)', () => {
    // Given: un patch con solo la ubicación y otro vacío
    // When: se normaliza cada patch
    // Then: solo incluye los campos presentes
    expect(normalizarPatch({ ubicacion: 'Envigado' })).toEqual({
      ubicacion: 'Envigado',
    });
    expect(normalizarPatch({})).toEqual({});
  });

  test('recorta espacios y acota longitudes', () => {
    // Given: una descripción con espacios y una ubicación de 200 caracteres
    // When: se normaliza el patch
    // Then: recorta espacios y acota las longitudes
    expect(
      normalizarPatch({
        descripcion: '  Hola  ',
        ubicacion: 'x'.repeat(200),
      })
    ).toEqual({ descripcion: 'Hola', ubicacion: 'x'.repeat(120) });
  });
});
