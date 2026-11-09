/**
 * E2E de la US-009 (Visualización del detalle de la tarea). Crea su propio
 * autor, un afiliado y un cliente por API; no necesita `.secret`.
 */
import { expect, test, type Page } from '@playwright/test';

const API = 'http://localhost:3000';
const marca = Date.now();
const password = `E2e-${marca}-Detalle!`;
const titulo = `US009 ${marca} grifo`;
const descripcion =
  'Descripción completa de la tarea US-009: el grifo gotea y hay que cambiar el empaque.';

const autor = `e2e.autor.${marca}@example.test`;
const afiliado = `e2e.afiliado9.${marca}@example.test`;
const cliente = `e2e.cliente9.${marca}@example.test`;
let tareaId = '';
let tareaSinUbicacionId = '';

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
      descripcion,
      categoria: 'Plomería',
      ubicacion: 'Laureles, Medellín',
      latitud: 6.244203,
      longitud: -75.581211,
    },
  });
  expect(r.status()).toBe(201);
  tareaId = ((await r.json()) as { id: string }).id;

  // Segunda tarea sin coordenadas para el caso "sin ubicación".
  const sinUbicacion = await request.post(`${API}/api/tareas`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      titulo: `US009 ${marca} sin ubicación`,
      descripcion: 'Tarea sin latitud ni longitud para el detalle.',
      categoria: 'Limpieza',
      ubicacion: 'Sin coordenadas',
    },
  });
  expect(sinUbicacion.status()).toBe(201);
  tareaSinUbicacionId = ((await sinUbicacion.json()) as { id: string }).id;
});

test('Esc 1-2: desde el tablero se abre el detalle completo y se puede ofertar', async ({
  page,
}) => {
  await entrar(page, afiliado);
  await page.goto('/tareas');
  const tarjeta = page.locator('.ch-tarea', { hasText: titulo });
  await tarjeta.getByRole('link', { name: 'Ver detalle' }).click();
  await page.waitForURL(new RegExp(`/tareas/detalle\\?id=${tareaId}`));

  await expect(page.getByRole('heading', { name: titulo })).toBeVisible();
  await expect(page.getByText(descripcion)).toBeVisible();
  await expect(page.locator('.ch-chip')).toHaveText('Plomería');
  await expect(page.getByText(/Laureles, Medellín/)).toBeVisible();
  await expect(page.locator('.ch-detalle__grid')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Usuario afiliado' })
  ).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: 'Enviar oferta' })
  ).toBeVisible();
  // Ubicación aproximada para un tercero.
  await expect(
    page.getByRole('img', { name: 'Mapa con la zona aproximada' })
  ).toBeVisible();
  await expect(page.getByText(/radio de 200 m/)).toBeVisible();
});

test('un cliente ve la tarea pero no puede ofertar', async ({ page }) => {
  await entrar(page, cliente);
  await page.goto(`/tareas/detalle?id=${tareaId}`);
  await expect(page.getByRole('heading', { name: titulo })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar oferta' })).toHaveCount(
    0
  );
});

test('Esc 4: el autor ve su tarea completa y sin botón de oferta', async ({
  page,
}) => {
  await entrar(page, autor);
  await page.goto(`/tareas/detalle?id=${tareaId}`);
  await expect(page.getByRole('heading', { name: titulo })).toBeVisible();
  await expect(page.getByText(descripcion)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar oferta' })).toHaveCount(
    0
  );
  await expect(
    page.getByText(/no puedes enviar una oferta a tu propia tarea/)
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Mapa con la ubicación' })
  ).toBeVisible();
});

test('sin coordenadas no hay mapa y la descripción ocupa el espacio', async ({
  page,
}) => {
  await entrar(page, afiliado);
  await page.goto(`/tareas/detalle?id=${tareaSinUbicacionId}`);
  await expect(
    page.getByRole('heading', { name: `US009 ${marca} sin ubicación` })
  ).toBeVisible();
  await expect(page.getByText('Tarea sin latitud ni longitud para el detalle.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Ubicación' })).toHaveCount(0);
  await expect(page.locator('.ch-map__canvas')).toHaveCount(0);
  await expect(page.locator('.ch-detalle__grid--sin-mapa')).toBeVisible();
});

test('Esc 3: si la tarea ya no está disponible avisa y vuelve al tablero', async ({
  page,
}) => {
  await entrar(page, afiliado);
  await page.route(`**/api/tareas/${tareaId}`, (ruta) =>
    ruta.fulfill({
      status: 410,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        error: 'GoneError',
        message: 'Esta tarea ya no se encuentra disponible.',
      }),
    })
  );
  await page.goto(`/tareas/detalle?id=${tareaId}`);
  await expect(page.getByRole('alert')).toContainText(
    'Lo sentimos, esta tarea ya no se encuentra disponible'
  );
  await expect(page.getByRole('heading', { name: titulo })).toHaveCount(0);
  await page.waitForURL(/\/tareas$/, { timeout: 10000 });
});

test('un id que no existe también se trata como no disponible', async ({
  page,
}) => {
  await entrar(page, afiliado);
  await page.goto('/tareas/detalle?id=00000000-0000-4000-8000-000000000000');
  await expect(page.getByRole('alert')).toContainText(
    'ya no se encuentra disponible'
  );
});
