/**
 * Hashing de contraseñas usando la API nativa de Bun (libsodium por debajo).
 * Se usa argon2id: es el algoritmo recomendado actualmente por OWASP para
 * almacenamiento de contraseñas (resistente a ataques por GPU/ASIC).
 * Nunca se debe loguear, exponer en respuestas ni guardar la contraseña
 * en texto plano en ningún punto del flujo.
 */

const HASH_OPTIONS = {
  algorithm: 'argon2id',
  memoryCost: 19456, // ~19 MB, recomendación OWASP para argon2id
  timeCost: 2,
} as const;

export function hashPassword(plainPassword: string): Promise<string> {
  return Bun.password.hash(plainPassword, HASH_OPTIONS);
}

export function verifyPassword(
  plainPassword: string,
  hash: string
): Promise<boolean> {
  return Bun.password.verify(plainPassword, hash);
}
