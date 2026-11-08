/**
 * E2E de la US-011 (Envío de oferta por parte del Afiliado). Crea su propio
 * autor, afiliado y cliente por API. Requiere la migración `ofertas`
 * aplicada en la base de datos del backend (`bun run db:migrate`).
 */
import { expect, test, type Page } from '@playwright/test';

const API = 'http://localhost:3000';
const marca = Date.now();
const password = `E2e-${marca}-Oferta!`;
const titulo = `US011 ${marca} grifo`;

const autor = `e2e.autor11.${marca}@example.test`;
const afiliado = `e2e.afiliado11.${marca}@example.test`;
const cliente = `e2e.cliente11.${marca}@example.test`;
let tareaId = '';

async function registrar(
  request: import('@playwright/test').APIRequestContext,
  email: string,
  rol: 'afiliado' | 'cliente'
): Promise<string> {
  const r = await request.post(`${API}/api/auth/register`, {
    data: { nombre: `Usuario ${rol}`, email, password, rol },
  });
  expect(r.status()).toBe(201);
  return ((await r.json()) as { token: string }).token;
}

async function entrar(page: Page, email: string) {
  await page.goto('/login');
  await page.locator('#ch-login-email').fill(email);
  await page.locator('#ch-login-password').fill(password);
  await page.getByRole('button', { name: /Iniciar sesión/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  const token = await registrar(request, autor, 'afiliado');
  await registrar(request, afiliado, 'afiliado');
  await registrar(request, cliente, 'cliente');
  const r = await request.post(`${API}/api/tareas`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      titulo,
      descripcion:
        'Tarea de la prueba E2E de la US-011: hay que cambiar el empaque del grifo.',
      categoria: 'Plomería',
      ubicacion: 'Laureles, Medellín',
    },
  });
  expect(r.status()).toBe(201);
  tareaId = ((await r.json()) as { id: string }).id;
});

test('Esc 6: un fallo de red muestra el aviso y permite reintentar', async ({
  page,
}) => {
  await entrar(page, afiliado);
  await page.route(`**/api/tareas/${tareaId}/ofertas`, (ruta) =>
    ruta.abort('failed')
  );
  await page.goto(`/tareas/detalle?id=${tareaId}`);
  await page.getByRole('button', { name: 'Enviar oferta' }).click();
  await page.getByRole('button', { name: 'Confirmar postulación' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Error de conexión. No pudimos enviar tu oferta'
  );
  // Sigue pudiendo reintentar.
  await expect(
    page.getByRole('button', { name: 'Confirmar postulación' })
  ).toBeEnabled();
});

test('Esc 5: si la tarea ya no acepta ofertas avisa y vuelve al tablero', async ({
  page,
}) => {
  await entrar(page, afiliado);
  await page.route(`**/api/tareas/${tareaId}/ofertas`, (ruta) =>
    ruta.fulfill({
      status: 410,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        error: 'GoneError',
        message: 'Lo sentimos, esta tarea ya no acepta nuevas ofertas',
      }),
    })
  );
  await page.goto(`/tareas/detalle?id=${tareaId}`);
  await page.getByRole('button', { name: 'Enviar oferta' }).click();
  await page.getByRole('button', { name: 'Confirmar postulación' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Lo sentimos, esta tarea ya no acepta nuevas ofertas en este momento'
  );
  await page.waitForURL(/\/tareas$/, { timeout: 10000 });
});

test('Esc 1-3: envía la oferta con mensaje y luego queda bloqueado', async ({
  page,
}) => {
  await entrar(page, afiliado);
  await page.goto(`/tareas/detalle?id=${tareaId}`);
  await page.getByRole('button', { name: 'Enviar oferta' }).click();
  await page
    .getByLabel(/Mensaje para el creador/)
    .fill('Tengo experiencia previa en trabajos de plomería.');
  await page.getByRole('button', { name: 'Confirmar postulación' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Tu oferta ha sido enviada exitosamente al creador de la tarea'
  );
  await expect(
    page.getByText('Ya te has postulado a esta tarea')
  ).toBeVisible();

  // Al volver a visitar el detalle sigue bloqueado.
  await page.reload();
  await expect(
    page.getByText('Ya te has postulado a esta tarea')
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Enviar oferta' })
  ).toBeDisabled();
});

test('Esc 4: un cliente no puede ofertar', async ({ page, request }) => {
  await entrar(page, cliente);
  await page.goto(`/tareas/detalle?id=${tareaId}`);
  await expect(page.getByRole('heading', { name: titulo })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar oferta' })).toHaveCount(
    0
  );

  // El backend también lo rechaza.
  const login = await request.post(`${API}/api/auth/login`, {
    data: { email: cliente, password },
  });
  const { token } = (await login.json()) as { token: string };
  const r = await request.post(`${API}/api/tareas/${tareaId}/ofertas`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {},
  });
  expect(r.status()).toBe(403);
});
