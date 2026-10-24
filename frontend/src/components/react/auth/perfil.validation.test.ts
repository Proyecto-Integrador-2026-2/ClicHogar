/**
 * Pruebas de las reglas de validación del perfil (US-004, Esc 3-5).
 * Puras y sin red: tipo/peso de foto, opcionalidad y límites.
 */
import { describe, expect, test } from 'bun:test';
import {
  MAX_DESCRIPCION,
  MAX_FOTO_BYTES,
  validarCampoPerfil,
  validarFoto,
  type ValoresPerfil,
} from './perfil.validation';

function archivo(nombre: string, tipo: string, tamano: number): File {
  const datos = new Uint8Array(Math.min(tamano, 1024));
  return new File([datos], nombre, { type: tipo });
}

const VACIO: ValoresPerfil = { foto: null, descripcion: '', ubicacion: '' };

describe('validarFoto', () => {
  test('sin foto es válido (opcional)', () => {
    // Given: ninguna foto seleccionada
    // When: se valida
    // Then: es válido porque la foto es opcional
    expect(validarFoto(null)).toBeUndefined();
  });

  test('acepta JPG y PNG dentro del límite', () => {
    // Given: una foto JPG y otra PNG de 1 KB
    // When: se valida cada una
    // Then: ambas son válidas
    expect(
      validarFoto(archivo('foto.jpg', 'image/jpeg', 1024))
    ).toBeUndefined();
    expect(validarFoto(archivo('foto.png', 'image/png', 1024))).toBeUndefined();
  });

  test('rechaza otros formatos (Esc 3)', () => {
    // Given: un PDF y un GIF como foto
    // When: se valida cada uno
    // Then: ambos se rechazan con el mensaje de formato
    expect(validarFoto(archivo('doc.pdf', 'application/pdf', 1024))).toBe(
      'La foto debe ser JPG o PNG.'
    );
    expect(validarFoto(archivo('anim.gif', 'image/gif', 1024))).toBe(
      'La foto debe ser JPG o PNG.'
    );
  });

  test('rechaza archivos sobre 5MB (Esc 4)', () => {
    // Given: una foto JPG que declara pesar 5 MB más un byte
    const grande = new File([new Uint8Array(10)], 'foto.jpg', {
      type: 'image/jpeg',
    });
    Object.defineProperty(grande, 'size', { value: MAX_FOTO_BYTES + 1 });
    // When: se valida
    // Then: se rechaza con el mensaje de peso máximo
    expect(validarFoto(grande)).toBe('La foto no puede superar 5MB.');
  });
});

describe('validarCampoPerfil', () => {
  test('textos siempre pasan (opcionales; el servidor acota)', () => {
    // Given: una descripción muy larga y una ubicación cualquiera
    // When: se valida cada campo de texto
    // Then: siempre pasan, porque el servidor los acota
    expect(
      validarCampoPerfil('descripcion', {
        ...VACIO,
        descripcion: 'x'.repeat(MAX_DESCRIPCION + 100),
      })
    ).toBeUndefined();
    expect(
      validarCampoPerfil('ubicacion', { ...VACIO, ubicacion: 'Medellín' })
    ).toBeUndefined();
  });

  test('delega la foto a validarFoto', () => {
    // Given: un PDF como foto
    // When: se valida el campo foto
    // Then: delega en validarFoto y rechaza el formato
    expect(
      validarCampoPerfil('foto', {
        ...VACIO,
        foto: archivo('doc.pdf', 'application/pdf', 10),
      })
    ).toBe('La foto debe ser JPG o PNG.');
  });
});
