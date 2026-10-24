/**
 * Pruebas del hashing argon2id. Solo ida: el hash nunca es la contraseña
 * y cada hash difiere por la sal; la verificación decide con el hash.
 */
import { describe, expect, test } from 'bun:test';
import { hashPassword, verifyPassword } from './password';

describe('password argon2id', () => {
  test('verifica la contraseña correcta y rechaza otra', async () => {
    // Given: una contraseña en claro
    // When: se hashea y se verifica la correcta y otra
    const hash = await hashPassword('Secreta123');
    // Then: el hash no contiene la clave, la correcta valida y la otra no
    expect(hash).not.toContain('Secreta123');
    expect(await verifyPassword('Secreta123', hash)).toBe(true);
    expect(await verifyPassword('otra-clave', hash)).toBe(false);
  });

  test('dos hashes de lo mismo difieren (sal aleatoria)', async () => {
    // Given: la misma contraseña
    const a = await hashPassword('repetida');
    // When: se hashea dos veces
    const b = await hashPassword('repetida');
    // Then: los hashes difieren por la sal pero ambos verifican
    expect(a).not.toBe(b);
    expect(await verifyPassword('repetida', a)).toBe(true);
    expect(await verifyPassword('repetida', b)).toBe(true);
  });
});
