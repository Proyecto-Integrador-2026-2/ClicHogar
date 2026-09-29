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

function archivo(
  nombre: string,
  tipo: string,
  tamano: number
): File {
  const datos = new Uint8Array(Math.min(tamano, 1024));
  return new File([datos], nombre, { type: tipo });
}

const VACIO: ValoresPerfil = { foto: null, descripcion: '', ubicacion: '' };

describe('validarFoto', () => {
  test('sin foto es válido (opcional)', () => {
    expect(validarFoto(null)).toBeUndefined();
  });

  test('acepta JPG y PNG dentro del límite', () => {
    expect(
      validarFoto(archivo('foto.jpg', 'image/jpeg', 1024))
    ).toBeUndefined();
    expect(
      validarFoto(archivo('foto.png', 'image/png', 1024))
    ).toBeUndefined();
  });

  test('rechaza otros formatos (Esc 3)', () => {
    expect(validarFoto(archivo('doc.pdf', 'application/pdf', 1024))).toBe(
      'La foto debe ser JPG o PNG.'
    );
    expect(validarFoto(archivo('anim.gif', 'image/gif', 1024))).toBe(
      'La foto debe ser JPG o PNG.'
    );
  });

  test('rechaza archivos sobre 5MB (Esc 4)', () => {
    const grande = new File([new Uint8Array(10)], 'foto.jpg', {
      type: 'image/jpeg',
    });
    Object.defineProperty(grande, 'size', { value: MAX_FOTO_BYTES + 1 });
    expect(validarFoto(grande)).toBe('La foto no puede superar 5MB.');
  });
});

describe('validarCampoPerfil', () => {
  test('textos siempre pasan (opcionales; el servidor acota)', () => {
    expect(
      validarCampoPerfil(
        'descripcion',
        { ...VACIO, descripcion: 'x'.repeat(MAX_DESCRIPCION + 100) }
      )
    ).toBeUndefined();
    expect(
      validarCampoPerfil('ubicacion', { ...VACIO, ubicacion: 'Medellín' })
    ).toBeUndefined();
  });

  test('delega la foto a validarFoto', () => {
    expect(
      validarCampoPerfil('foto', {
        ...VACIO,
        foto: archivo('doc.pdf', 'application/pdf', 10),
      })
    ).toBe('La foto debe ser JPG o PNG.');
  });
});
