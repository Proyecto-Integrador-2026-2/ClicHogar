/**
 * E2E de la US-017 (Actualización pública de la reputación del Afiliado).
 * Crea su propio cliente, afiliados y tareas por API; no necesita `.secret`.
 */
import { expect, test, type Page } from '@playwright/test';

const API = 'http://localhost:3000';
const marca = Date.now();
const password = `E2e-${marca}-Reputa!`;
const emailCliente = `e2e.cliente17.${marca}@example.test`;

type Peticiones = import('@playwright/test').APIRequestContext;

let tokenCliente = '';
let idAfiliado = '';
let idNuevo = '';
let tokenAfiliado = '';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function registrar(
  request: Peticiones,
  nombre: string,
  email: string,
  rol: 'afiliado' | 'cliente'
): Promise<{ token: string; id: string }> {
  const r = await request.post(`${API}/api/auth/register`, {
    data: { nombre, email, password, rol },
  });
  expect(r.status()).toBe(201);
  const c = (await r.json()) as { token: string; usuario: { id: string } };
  return { token: c.token, id: c.usuario.id };
}

/** Crea una tarea, la asigna al afiliado y (opcional) la finaliza y califica. */
async function servicio(
  request: Peticiones,
  titulo: string,
  puntuacion: number | null,
  finalizar: boolean
) {
  const t = await request.post(`${API}/api/tareas`, {
    headers: auth(tokenCliente),
    data: {
      titulo,
      descripcion: 'Tarea de la prueba E2E de la US-017: reputación.',
      categoria: 'Plomería',
      ubicacion: 'Laureles, Medellín',
    },
  });
  expect(t.status()).toBe(201);
  const tareaId = ((await t.json()) as { id: string }).id;
  const o = await request.post(`${API}/api/tareas/${tareaId}/ofertas`, {
    headers: auth(tokenAfiliado),
    data: { mensaje: 'Puedo ir hoy mismo.' },
  });
  expect(o.status()).toBe(201);
  const ofertaId = ((await o.json()) as { id: string }).id;
  const a = await request.post(`${API}/api/tareas/${tareaId}/asignar`, {
    headers: auth(tokenCliente),
    data: { ofertaId },
  });
  expect(a.status()).toBe(200);
  if (!finalizar) return;
  const f = await request.post(`${API}/api/tareas/${tareaId}/finalizar`, {
    headers: auth(tokenCliente),
    data: { pagoConfirmado: true },
  });
  expect(f.status()).toBe(200);
  if (puntuacion === null) return;
  const c = await request.post(`${API}/api/calificaciones`, {
    headers: auth(tokenCliente),
    data: { tareaId, puntuacion },
  });
  expect(c.status()).toBe(201);
}

async function entrar(page: Page) {
  await page.goto('/login');
  await page.locator('#ch-login-email').fill(emailCliente);
  await page.locator('#ch-login-password').fill(password);
  await page.getByRole('button', { name: /Iniciar sesión/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  const cliente = await registrar(
    request,
    'Cliente Diecisiete',
    emailCliente,
    'cliente'
  );
  tokenCliente = cliente.token;
  const afiliado = await registrar(
    request,
    'Afiliado Reputado',
    `e2e.afiliado17.${marca}@example.test`,
    'afiliado'
  );
  tokenAfiliado = afiliado.token;
  idAfiliado = afiliado.id;
  idNuevo = (
    await registrar(
      request,
      'Afiliado Recien Llegado',
      `e2e.nuevo17.${marca}@example.test`,
      'afiliado'
    )
  ).id;

  // Tres servicios finalizados y calificados: 5, 5 y 4 -> 4,666… -> 4,7.
  await servicio(request, `US017 ${marca} uno`, 5, true);
  await servicio(request, `US017 ${marca} dos`, 5, true);
  await servicio(request, `US017 ${marca} tres`, 4, true);
  // Esc 5: una tarea asignada pero sin finalizar no cuenta.
  await servicio(request, `US017 ${marca} asignada`, null, false);
});

test('Esc 1, 2 y 4: el perfil muestra el promedio redondeado y las valoraciones con cliente y fecha', async ({
  page,
}) => {
  await entrar(page);
  await page.goto(`/perfil/publico?id=${idAfiliado}`);
  await expect(page.getByText('4,7 / 5,0 estrellas')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Valoraciones' })
  ).toBeVisible();
  const clientes = page.getByRole('heading', { level: 4 });
  await expect(clientes).toHaveText([
    'Cliente Diecisiete',
    'Cliente Diecisiete',
    'Cliente Diecisiete',
  ]);
  await expect(page.getByText(/Servicio realizado el/)).toHaveCount(3);
});

test('Esc 3: un afiliado nuevo muestra el estado neutral, sin 0,0', async ({
  page,
}) => {
  await entrar(page);
  await page.goto(`/perfil/publico?id=${idNuevo}`);
  await expect(
    page.getByText(
      'Nuevo en la plataforma. Este afiliado aún no tiene valoraciones.'
    )
  ).toBeVisible();
  await expect(page.getByText(/0,0/)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Valoraciones' })).toHaveCount(
    0
  );
});

test('Esc 5: la API solo cuenta las valoraciones de tareas finalizadas', async ({
  request,
}) => {
  const r = await request.get(
    `${API}/api/calificaciones/usuario/${idAfiliado}`
  );
  const rep = (await r.json()) as { promedio: number; total: number };
  expect(rep.total).toBe(3);
  expect(rep.promedio).toBe(4.7);
});
