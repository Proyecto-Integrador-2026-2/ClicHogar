import { test } from '@playwright/test';
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

async function login(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
  destino: RegExp
) {
  await page.goto('/login');
  await page.locator('#ch-login-email').fill(email);
  await page.locator('#ch-login-password').fill(password);
  await page.getByRole('button', { name: /Iniciar sesión/i }).click();
  await page.waitForURL(destino, { timeout: 15000 });
}

test('login de usuario (rol Usuario) y afiliado', async ({ page }) => {
  const s = leerSecretos();
  await login(page, s.USUARIO_EMAIL, s.USUARIO_PASSWORD, /\/dashboard/);
  const ctx = await page.context().browser()!.newContext();
  const page2 = await ctx.newPage();
  await login(page2, s.AFILIADO_EMAIL, s.AFILIADO_PASSWORD, /\/dashboard/);
  await ctx.close();
});
