/**
 * Pruebas de las reglas de validación del registro (US-001, Esc 4–9).
 * Puras y sin BD ni Clerk: cubren cada rama de `validarCampo` con los
 * mensajes exactos que ve el usuario.
 */
import { describe, expect, test } from 'bun:test';
import { validarCampo, type Valores } from './register.validation';

const VALIDOS: Valores = {
  name: 'Ana Pérez',
  email: 'ana@ejemplo.com',
  password: 'Segura123',
  confirmPassword: 'Segura123',
  role: 'Usuario',
  termsAccepted: true,
};

function con(parche: Partial<Valores>): Valores {
  return { ...VALIDOS, ...parche };
}

describe('validarCampo', () => {
  test('acepta un formulario válido (todo undefined)', () => {
    // Given: un formulario completamente válido
    // When: se valida cada campo
    // Then: todos devuelven undefined
    expect(validarCampo('name', VALIDOS)).toBeUndefined();
    expect(validarCampo('email', VALIDOS)).toBeUndefined();
    expect(validarCampo('password', VALIDOS)).toBeUndefined();
    expect(validarCampo('confirmPassword', VALIDOS)).toBeUndefined();
    expect(validarCampo('role', VALIDOS)).toBeUndefined();
    expect(validarCampo('terms', VALIDOS)).toBeUndefined();
  });

  test('nombre vacío o en blancos es obligatorio (Esc 6)', () => {
    // Given: un nombre vacío y otro compuesto de espacios
    // When: se valida el nombre
    // Then: ambos son obligatorios
    expect(validarCampo('name', con({ name: '' }))).toBe(
      'Este campo es obligatorio'
    );
    expect(validarCampo('name', con({ name: '   ' }))).toBe(
      'Este campo es obligatorio'
    );
  });

  test('email vacío es obligatorio y con formato inválido se rechaza (Esc 6-7)', () => {
    // Given: un email vacío, otro sin arroba y otro sin dominio completo
    // When: se valida el email
    expect(validarCampo('email', con({ email: '' }))).toBe(
      'Este campo es obligatorio'
    );
    // Then: el vacío es obligatorio y los demás se rechazan por formato
    expect(validarCampo('email', con({ email: 'no-es-email' }))).toBe(
      'Por favor, ingresa un correo electrónico válido'
    );
    expect(validarCampo('email', con({ email: 'a@b' }))).toBe(
      'Por favor, ingresa un correo electrónico válido'
    );
  });

  test('password débil se rechaza con el mensaje de política (Esc 8)', () => {
    // Given: contraseñas vacía, corta, sin mayúscula y sin número
    const mensaje =
      'La contraseña debe tener al menos 8 caracteres, incluir números y mayúsculas';
    // When: se valida cada contraseña
    expect(validarCampo('password', con({ password: '' }))).toBe(
      'Este campo es obligatorio'
    );
    // Then: la vacía es obligatoria y las débiles devuelven el mensaje de política
    expect(validarCampo('password', con({ password: 'Corta1' }))).toBe(mensaje);
    expect(validarCampo('password', con({ password: 'sinmayuscula1' }))).toBe(
      mensaje
    );
    expect(validarCampo('password', con({ password: 'SinNumeros' }))).toBe(
      mensaje
    );
  });

  test('confirmación distinta se rechaza (Esc 9)', () => {
    // Given: una confirmación distinta de la contraseña
    // When: se valida la confirmación
    // Then: se rechaza
    expect(
      validarCampo('confirmPassword', con({ confirmPassword: 'Otra12345' }))
    ).toBe('Las contraseñas no coinciden');
  });

  test('confirmación vacía no bloquea (se valida al completar ambos)', () => {
    // Given: una confirmación vacía
    // When: se valida la confirmación
    // Then: no bloquea, se valida al completar ambas
    expect(
      validarCampo('confirmPassword', con({ confirmPassword: '' }))
    ).toBeUndefined();
  });

  test('sin rol se rechaza (Esc 5)', () => {
    // Given: un formulario sin rol seleccionado
    // When: se valida el rol
    // Then: se rechaza
    expect(validarCampo('role', con({ role: '' }))).toBe(
      'Por favor, selecciona cómo deseas usar la plataforma'
    );
  });

  test('sin aceptar términos se rechaza (Esc 4)', () => {
    // Given: un formulario sin aceptar los términos
    // When: se valida la aceptación
    // Then: se rechaza
    expect(validarCampo('terms', con({ termsAccepted: false }))).toBe(
      'Debes aceptar los Términos, Condiciones y Política de Datos'
    );
  });
});
