/**
 * Pruebas del matcher de rutas protegidas (US-003, tarea #129).
 * Puras y sin Clerk: la decisión de guardia debe ser exacta para no
 * bloquear páginas públicas ni dejar huecos.
 */
import { describe, expect, test } from 'bun:test';
import { isProtectedRoute } from './routes';

describe('isProtectedRoute', () => {
  test('protege paneles y perfiles, con o sin slash final', () => {
    expect(isProtectedRoute('/dashboard')).toBe(true);
    expect(isProtectedRoute('/dashboard/')).toBe(true);
    expect(isProtectedRoute('/dashboard/tareas')).toBe(true);
    expect(isProtectedRoute('/perfil')).toBe(true);
    expect(isProtectedRoute('/perfil/configurar')).toBe(true);
  });

  test('deja pasar páginas públicas', () => {
    expect(isProtectedRoute('/')).toBe(false);
    expect(isProtectedRoute('/login')).toBe(false);
    expect(isProtectedRoute('/register')).toBe(false);
    expect(isProtectedRoute('/favicon.ico')).toBe(false);
  });

  test('no protege por prefijo parcial', () => {
    expect(isProtectedRoute('/perfiles')).toBe(false);
    expect(isProtectedRoute('/dashboardx')).toBe(false);
    expect(isProtectedRoute('/mi-dashboard')).toBe(false);
  });
});
