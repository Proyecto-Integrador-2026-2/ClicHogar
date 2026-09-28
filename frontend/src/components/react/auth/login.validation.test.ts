/**
 * Pruebas de las reglas de validación del login (US-002, Esc 5-8).
 * Puras y sin Clerk: cubren vacíos, formato, saneamiento y mensajes.
 */
import { describe, expect, test } from 'bun:test';
import {
  sanearEmail,
  validarCampoLogin,
  type ValoresLogin,
} from './login.validation';

const VALIDOS: ValoresLogin = {
  email: 'ana@ejemplo.com',
  password: 'Cualquier1',
};

describe('validarCampoLogin', () => {
  test('acepta credenciales con forma válida', () => {
    expect(validarCampoLogin('email', VALIDOS)).toBeUndefined();
    expect(validarCampoLogin('password', VALIDOS)).toBeUndefined();
  });

  test('campos vacíos son obligatorios (Esc 5)', () => {
    expect(
      validarCampoLogin('email', { ...VALIDOS, email: '' })
    ).toBe('Este campo es obligatorio');
    expect(
      validarCampoLogin('password', { ...VALIDOS, password: '' })
    ).toBe('Este campo es obligatorio');
  });

  test('email con formato inválido se rechaza (Esc 6)', () => {
    expect(
      validarCampoLogin('email', { ...VALIDOS, email: 'no-es-email' })
    ).toBe('Por favor, ingresa un correo electrónico válido');
  });

  test('email con espacios alrededor pasa (se sanea al enviar)', () => {
    expect(
      validarCampoLogin('email', { ...VALIDOS, email: '  ana@ejemplo.com  ' })
    ).toBeUndefined();
  });
});

describe('sanearEmail', () => {
  test('recorta espacios y minúsculas (Esc 7/8)', () => {
    expect(sanearEmail('  Ana@Ejemplo.COM  ')).toBe('ana@ejemplo.com');
  });

  test('deja intacto un email ya limpio', () => {
    expect(sanearEmail('ana@ejemplo.com')).toBe('ana@ejemplo.com');
  });
});
