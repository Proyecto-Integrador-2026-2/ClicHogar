/**
 * E2E de "Mis ofertas" (`/dashboard/ofertas/mias`).
 * Crea su propio cliente y dos afiliados, una tarea, una oferta y la
 * asignación por API; no necesita `.secret`.
 */
import { expect, test, type Page } from '@playwright/test';

const API = 'http://localhost:3000';
const marca = Date.now();
const password = `E2e-${marca}-Misofertas!`;
const titulo = `Ofertas ${marca} aceptada`;

const emailCliente = `e2e.cliente.mis.${marca}@example.test`;
const emailAfiliado = `e2e.afiliado.mis.${marca}@example.test`;
const emailOtro = `e2e.otro.mis.${marca}@example.test`;

let tokenAfiliado = '';
let tareaId = '';

type Peticiones = import('@playwright/test').APIRequestContext;

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
  const cuerpo = (await r.json()) as { token: string; usuario: { id: string } };
  return { token: cuerpo.token, id: cuerpo.usuario.id };
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
  const cliente = await registrar(
    request,
    'Cliente Ofertas',
    emailCliente,
    'cliente'
  );
  const afiliado = await registrar(
    request,
    'Afiliado Elegido',
    emailAfiliado,
    'afiliado'
  );
  await registrar(request, 'Afiliado Otro', emailOtro, 'afiliado');
  tokenAfiliado = afiliado.token;

  const tarea = await request.post(`${API}/api/tareas`, {
    headers: { Authorization: `Bearer ${cliente.token}` },
    data: {
      titulo,
      descripcion:
        'Tarea de la prueba E2E de "Mis ofertas": revisar los dos bloques.',
      categoria: 'Plomería',
      ubicacion: 'Laureles, Medellín',
    },
  });
  expect(tarea.status()).toBe(201);
  tareaId = ((await tarea.json()) as { id: string }).id;

  const oferta = await request.post(`${API}/api/tareas/${tareaId}/ofertas`, {
    headers: { Authorization: `Bearer ${tokenAfiliado}` },
    data: { mensaje: 'Tengo experiencia' },
  });
  expect(oferta.status()).toBe(201);

  const asignada = await request.post(
    `${API}/api/tareas/${tareaId}/asignar`,
    {
      headers: { Authorization: `Bearer ${cliente.token}` },
      data: { ofertaId: ((await oferta.json()) as { id: string }).id },
    }
  );
  expect(asignada.status()).toBe(200);
});

test('el cliente NO ve el módulo "Ver todas mis ofertas" (solo para afiliado)', async ({
  page,
}) => {
  await entrar(page, emailCliente);
  // El módulo está oculto para clientes por la clase ch-dash-module--solo-afiliado
  const modulo = page.getByRole('link', { name: /Ver todas mis ofertas/i });
  await expect(modulo).toHaveCount(0);
});

test('el afiliado elegido ve "Tareas aceptadas" con el detalle', async ({
  page,
}) => {
  await entrar(page, emailAfiliado);
  await page.goto('/dashboard/ofertas/mias');

  const aceptadas = page.getByRole('region', { name: 'Tareas aceptadas' });
  await expect(aceptadas.getByText(titulo)).toBeVisible();
  await expect(aceptadas.getByText('Cliente: Cliente Ofertas')).toBeVisible();
  await expect(
    aceptadas.getByRole('link', { name: 'Ver' })
  ).toHaveAttribute('href', `/tareas/detalle?id=${tareaId}`);
});

test('un afiliado sin tareas aceptadas no ve el bloque superior', async ({
  page,
}) => {
  await entrar(page, emailOtro);
  await page.goto('/dashboard/ofertas/mias');

  // El bloque superior debe estar vacío (sin tareas aceptadas)
  await expect(
    page.getByRole('region', { name: 'Tareas aceptadas' })
  ).toHaveCount(0);
  // El bloque inferior debe estar visible con mensaje de sin tareas
  await expect(
    page.getByRole('region', { name: 'Mis tareas publicadas' })
  ).toBeVisible();
  // Puede aparecer mensaje de sin tareas o estar vacío; verificamos que no haya el bloque de tareas aceptadas
});