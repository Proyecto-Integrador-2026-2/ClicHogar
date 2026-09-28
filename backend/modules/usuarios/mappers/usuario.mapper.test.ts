/**
 * Pruebas del mapper público de usuarios (US-001).
 * Puras y sin BD: verifican que la frontera controller→JSON nunca filtre
 * credenciales ni identificadores internos de Clerk.
 */
import { describe, expect, test } from 'bun:test';
import type { Usuario } from '../entities/usuario.entity';
import { toUsuarioPublico } from './usuario.mapper';

const USUARIO_BASE: Usuario = {
  id: '11111111-1111-4111-8111-111111111111',
  clerkId: 'user_secreto_123',
  nombre: 'Ana Pérez',
  email: 'ana@ejemplo.com',
  passwordHash: 'argon2id$hash_super_secreto',
  rol: 'afiliado',
  activo: true,
  creadoEn: new Date('2026-01-15T10:00:00.000Z'),
  actualizadoEn: new Date('2026-02-01T10:00:00.000Z'),
};

describe('toUsuarioPublico', () => {
  test('mapea id, nombre, email, rol y fecha de creación', () => {
    expect(toUsuarioPublico(USUARIO_BASE)).toEqual({
      id: USUARIO_BASE.id,
      nombre: 'Ana Pérez',
      email: 'ana@ejemplo.com',
      rol: 'afiliado',
      creadoEn: USUARIO_BASE.creadoEn,
    });
  });

  test('nunca expone el hash de la contraseña', () => {
    const publico = toUsuarioPublico(USUARIO_BASE);
    expect(publico).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(publico)).not.toContain('hash_super_secreto');
  });

  test('no filtra clerkId, estado interno ni fecha de actualización', () => {
    const publico = toUsuarioPublico(USUARIO_BASE);
    expect(publico).not.toHaveProperty('clerkId');
    expect(publico).not.toHaveProperty('activo');
    expect(publico).not.toHaveProperty('actualizadoEn');
    expect(JSON.stringify(publico)).not.toContain('user_secreto_123');
  });
});
