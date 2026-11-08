import { describe, expect, test } from 'bun:test';
import {
  validarContrasenaNueva,
  validarCorreoRecuperacion,
} from './recuperacion.validation';

describe('validarCorreoRecuperacion', () => {
  test('exige un correo con formato válido', () => {
    // Given / When / Then: vacío, mal formado y válido
    expect(validarCorreoRecuperacion('  ')).toBe('Este campo es obligatorio');
    expect(validarCorreoRecuperacion('sin-arroba')).toBe(
      'Por favor, ingresa un correo electrónico válido'
    );
    expect(validarCorreoRecuperacion('ana@ejemplo.com')).toBeUndefined();
  });
});

describe('validarContrasenaNueva', () => {
  test('aplica las reglas del registro y pide confirmar', () => {
    // Given / When / Then: todo vacío
    expect(validarContrasenaNueva('', '')).toEqual({
      password: 'Este campo es obligatorio',
      confirmPassword: 'Este campo es obligatorio',
    });
    // Given / When / Then: clave débil
    expect(validarContrasenaNueva('corta', 'corta').password).toContain(
      'al menos 8 caracteres'
    );
    // Given / When / Then: no coinciden
    expect(validarContrasenaNueva('NuevaClave1', 'OtraClave1')).toEqual({
      confirmPassword: 'Las contraseñas no coinciden',
    });
    // Given / When / Then: válida
    expect(validarContrasenaNueva('NuevaClave1', 'NuevaClave1')).toEqual({});
  });
});
