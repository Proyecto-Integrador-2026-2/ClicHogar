import { expect, test } from '@playwright/test';

test('landing carga y muestra CTA', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/ClicHogar/i);
  await expect(
    page.getByRole('link', { name: /Crear cuenta gratis/i })
  ).toBeVisible();
});

test('login carga formulario', async ({ page }) => {
  await page.goto('/login');
  await expect(
    page.getByRole('heading', { name: /Hola de nuevo/i })
  ).toBeVisible();
});

test('register carga formulario', async ({ page }) => {
  await page.goto('/register');
  await expect(
    page.getByRole('heading', { name: /Bienvenido a Clic Hogar/i })
  ).toBeVisible();
});

test('backend health responde ok', async ({ request }) => {
  const res = await request.get('http://localhost:3000/health');
  expect(res.ok()).toBeTruthy();
  expect(await res.json()).toEqual({ status: 'ok' });
});
