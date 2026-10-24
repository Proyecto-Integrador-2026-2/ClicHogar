/**
 * Pruebas del matcher de rutas protegidas (US-003, tarea #129).
 * Puras y sin Clerk: la decisión de guardia debe ser exacta para no
 * bloquear páginas públicas ni dejar huecos.
 */
import { describe, expect, test } from 'bun:test';
import { isProtectedRoute } from './routes';

describe('isProtectedRoute', () => {
  test('protege paneles y perfiles, con o sin slash final', () => {
    // Given: rutas de paneles y perfiles, con y sin slash final
    // When: se consulta cada una
    // Then: todas exigen sesión
    expect(isProtectedRoute('/dashboard')).toBe(true);
    expect(isProtectedRoute('/dashboard/')).toBe(true);
    expect(isProtectedRoute('/dashboard/tareas')).toBe(true);
    expect(isProtectedRoute('/perfil')).toBe(true);
    expect(isProtectedRoute('/perfil/configurar')).toBe(true);
  });

  test('deja pasar páginas públicas', () => {
    // Given: rutas públicas como la raíz, login y registro
    // When: se consulta cada una
    // Then: ninguna exige sesión
    expect(isProtectedRoute('/')).toBe(false);
    expect(isProtectedRoute('/login')).toBe(false);
    expect(isProtectedRoute('/register')).toBe(false);
    expect(isProtectedRoute('/favicon.ico')).toBe(false);
  });

  test('no protege por prefijo parcial', () => {
    // Given: rutas que solo se parecen a las protegidas por el prefijo
    // When: se consulta cada una
    // Then: ninguna exige sesión
    expect(isProtectedRoute('/perfiles')).toBe(false);
    expect(isProtectedRoute('/dashboardx')).toBe(false);
    expect(isProtectedRoute('/mi-dashboard')).toBe(false);
  });

  test('protege la publicación (exacta) sin cerrar futuras listas', () => {
    // Given: la ruta exacta de publicar tareas y la lista de tareas
    // When: se consulta cada una
    // Then: publicar exige sesión y la lista sigue abierta
    expect(isProtectedRoute('/tareas/nueva')).toBe(true);
    expect(isProtectedRoute('/tareas/nueva/')).toBe(true);
    expect(isProtectedRoute('/tareas')).toBe(false);
  });
});
