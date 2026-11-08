/**
 * E2E de "Olvidé mi contraseña": enlace desde el login, solicitud con la
 * misma respuesta para cuentas existentes e inexistentes, y enlaces
 * inválidos. Crea su propia cuenta por API; no necesita `.secret`.
 * Requiere la migración 0011 aplicada (`bun run db:migrate`).
 * El cambio de contraseña con un enlace real se comprueba en las pruebas
 * del backend: el enlace solo llega por correo (o a la consola del servidor).
 */
import { expect, test } from '@playwright/test';

const API = 'http://localhost:3000';
const marca = Date.now();
const email = `e2e.recuperar.${marca}@example.test`;
const password = `E2e-${marca}-Recupera!`;

const GENERICO =
  'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.';
const ENLACE_INVALIDO =
  'El enlace no es válido o ya expiró. Solicita uno nuevo.';

test.beforeAll(async ({ request }) => {
  const r = await request.post(`${API}/api/auth/register`, {
    data: { nombre: 'Cliente Recupera', email, password, rol: 'cliente' },
  });
  expect(r.status()).toBe(201);
});

test('el login ofrece el enlace y lleva a la página de recuperación', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click();
  await page.waitForURL('**/olvide-contrasena');
  await expect(
    page.getByRole('heading', { name: '¿Olvidaste tu contraseña?' })
  ).toBeVisible();
});

test('un correo mal formado no se envía', async ({ page }) => {
  await page.goto('/olvide-contrasena');
  await page.getByLabel(/Correo electrónico/).fill('sin-arroba');
  await page.getByRole('button', { name: 'Enviar enlace' }).click();
  await expect(
    page.getByText('Por favor, ingresa un correo electrónico válido')
  ).toBeVisible();
});

test('una cuenta existente y una inexistente reciben el mismo mensaje', async ({
  page,
}) => {
  for (const correo of [email, `nadie.${marca}@example.test`]) {
    await page.goto('/olvide-contrasena');
    await page.getByLabel(/Correo electrónico/).fill(correo);
    await page.getByRole('button', { name: 'Enviar enlace' }).click();
    await expect(page.getByRole('status')).toHaveText(GENERICO);
  }
});

test('restablecer sin enlace o con un enlace inválido muestra el error', async ({
  page,
}) => {
  await page.goto('/restablecer-contrasena');
  await expect(page.getByRole('alert')).toHaveText(ENLACE_INVALIDO);
  await expect(
    page.getByRole('link', { name: 'Solicitar un enlace nuevo' })
  ).toBeVisible();

  await page.goto('/restablecer-contrasena?token=token-inventado');
  await page.getByLabel(/^Contraseña nueva/).fill('NuevaClave1');
  await page.getByLabel(/^Confirmar contraseña nueva/).fill('NuevaClave1');
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
  await expect(page.getByRole('alert')).toContainText(ENLACE_INVALIDO);
});

test('la contraseña original sigue funcionando tras los intentos fallidos', async ({
  request,
}) => {
  const r = await request.post(`${API}/api/auth/login`, {
    data: { email, password },
  });
  expect(r.status()).toBe(200);
});
