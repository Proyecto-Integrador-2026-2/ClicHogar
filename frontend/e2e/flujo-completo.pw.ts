import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

function leerSecretos(): Record<string, string> {
  const archivo = path.resolve(process.cwd(), '..', '.secret');
  const texto = fs.readFileSync(archivo, 'utf8');
  const out: Record<string, string> = {};
  for (const linea of texto.split(/\r?\n/)) {
    const t = linea.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx < 0) continue;
    out[t.slice(0, idx).trim()] = t.slice(idx + 1).trim();
  }
  return out;
}

test('flujo completo: login, publicar tarea y ver en tablero', async ({
  page,
}) => {
  const s = leerSecretos();
  // Login como usuario
  await page.goto('/login');
  await page.locator('#ch-login-email').fill(s.USUARIO_EMAIL);
  await page.locator('#ch-login-password').fill(s.USUARIO_PASSWORD);
  await page.getByRole('button', { name: /Iniciar sesión/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });

  // Publicar tarea
  await page.goto('/tareas/nueva');
  const titulo = `Tarea E2E ${Date.now()}`;
  await page.locator('#ch-tarea-titulo').fill(titulo);
  await page
    .locator('#ch-tarea-descripcion')
    .fill(
      'Esta es una tarea creada por el flujo E2E para verificar el mapa y el tablero.'
    );
  await page.locator('#ch-tarea-categoria').selectOption('Plomería');
  await page.locator('#ch-tarea-ubicacion').fill('Envigado');
  await page.getByRole('button', { name: /Publicar tarea/i }).click();
  await expect(page.getByText(/Tarea publicada/i)).toBeVisible({
    timeout: 15000,
  });

  // Ver en tablero
  await page.goto('/tareas');
  await expect(page.getByText(titulo).first()).toBeVisible({ timeout: 15000 });
});
