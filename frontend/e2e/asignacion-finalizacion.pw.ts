/**
 * E2E de la US-013 (Selección del prestador y asignación) y la US-014
 * (Finalización de la tarea y confirmación de pago). Crea su propio cliente,
 * dos afiliados, una tarea y dos ofertas por API; no necesita `.secret`.
 * Requiere las migraciones aplicadas (`bun run db:migrate`, incluida 0009).
 */
import { expect, test, type Page } from '@playwright/test';

const API = 'http://localhost:3000';
const marca = Date.now();
const password = `E2e-${marca}-Asigna!`;
const titulo = `US013 ${marca} asignación`;

const emailCliente = `e2e.cliente13.${marca}@example.test`;
const emailElegido = `e2e.elegido13.${marca}@example.test`;
const emailOtro = `e2e.otro13.${marca}@example.test`;

let tokenCliente = '';
let tokenElegido = '';
let tokenOtro = '';
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
  const c = (await r.json()) as { token: string; usuario: { id: string } };
  return { token: c.token, id: c.usuario.id };
}

async function entrar(page: Page, email: string) {
  await page.goto('/login');
  await page.locator('#ch-login-email').fill(email);
  await page.locator('#ch-login-password').fill(password);
  await page.getByRole('button', { name: /Iniciar sesión/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  const cliente = await registrar(
    request,
    'Cliente Trece',
    emailCliente,
    'cliente'
  );
  const elegido = await registrar(
    request,
    'Afiliado Elegido',
    emailElegido,
    'afiliado'
  );
  const otro = await registrar(request, 'Afiliado Otro', emailOtro, 'afiliado');
  tokenCliente = cliente.token;
  tokenElegido = elegido.token;
  tokenOtro = otro.token;

  const t = await request.post(`${API}/api/tareas`, {
    headers: auth(tokenCliente),
    data: {
      titulo,
      descripcion:
        'Tarea de la prueba E2E de las US-013 y US-014: asignar y cerrar.',
      categoria: 'Plomería',
      ubicacion: 'Laureles, Medellín',
    },
  });
  expect(t.status()).toBe(201);
  tareaId = ((await t.json()) as { id: string }).id;

  for (const [token, mensaje] of [
    [tokenOtro, 'Puedo ir hoy mismo.'],
    [tokenElegido, 'Tengo 8 años de experiencia.'],
  ] as const) {
    const o = await request.post(`${API}/api/tareas/${tareaId}/ofertas`, {
      headers: auth(token),
      data: { mensaje },
    });
    expect(o.status()).toBe(201);
  }
});

test('Esc 6 (US-013): cancelar la confirmación deja la tarea abierta', async ({
  page,
}) => {
  await entrar(page, emailCliente);
  await page.goto(`/tareas/detalle?id=${tareaId}`);
  const tarjeta = page.locator('.ch-oferta', { hasText: 'Afiliado Elegido' });
  await tarjeta.getByRole('button', { name: 'Seleccionar afiliado' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.ch-badge', { hasText: 'Abierta' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Seleccionar afiliado' })
  ).toHaveCount(2);
});

test('Esc 1-4 (US-013): selecciona al afiliado y la tarea queda asignada y cerrada a ofertas', async ({
  page,
  request,
}) => {
  await entrar(page, emailCliente);
  await page.goto(`/tareas/detalle?id=${tareaId}`);
  const tarjeta = page.locator('.ch-oferta', { hasText: 'Afiliado Elegido' });
  await tarjeta.getByRole('button', { name: 'Seleccionar afiliado' }).click();
  await page.getByRole('button', { name: 'Confirmar selección' }).click();

  // Esc 1: mensaje de éxito y estado asignado con el afiliado vinculado.
  await expect(
    page.getByText(
      '¡Afiliado seleccionado! Ahora pueden coordinar los detalles del servicio.'
    )
  ).toBeVisible();
  await expect(
    page.locator('.ch-badge', { hasText: 'asignada' }).first()
  ).toBeVisible();
  // Esc 2: contacto del afiliado para el creador.
  await expect(page.getByText(emailElegido)).toBeVisible();
  // Esc 3: las demás ofertas quedan rechazadas.
  await expect(
    page
      .locator('.ch-oferta', { hasText: 'Afiliado Otro' })
      .getByText('No seleccionado')
  ).toBeVisible();
  await expect(
    page
      .locator('.ch-oferta', { hasText: 'Afiliado Elegido' })
      .getByText('Seleccionado', { exact: true })
  ).toBeVisible();

  // Esc 4: desaparece del tablero y ya no recibe ofertas.
  await page.goto('/tareas');
  await expect(page.getByText(titulo)).toHaveCount(0);
  const nueva = await registrar(
    request,
    'Afiliado Tardio',
    `e2e.tardio13.${marca}@example.test`,
    'afiliado'
  );
  const tarde = await request.post(`${API}/api/tareas/${tareaId}/ofertas`, {
    headers: auth(nueva.token),
    data: {},
  });
  expect(tarde.status()).toBe(410);
});

test('Esc 5 (US-013): una segunda asignación se rechaza con el mensaje de la historia', async ({
  request,
}) => {
  const lista = await request.get(`${API}/api/tareas/${tareaId}/ofertas`, {
    headers: auth(tokenCliente),
  });
  const ofertas = (await lista.json()) as Array<{ id: string }>;
  const r = await request.post(`${API}/api/tareas/${tareaId}/asignar`, {
    headers: auth(tokenCliente),
    data: { ofertaId: ofertas[0]!.id },
  });
  expect(r.status()).toBe(409);
  expect(((await r.json()) as { message: string }).message).toBe(
    'Esta tarea ya cuenta con un afiliado asignado'
  );
});

test('Esc 2 (US-013) y Esc 3 (US-014): el afiliado elegido ve el contacto del cliente y debe esperar el cierre', async ({
  page,
  request,
}) => {
  await entrar(page, emailElegido);
  await page.goto(`/tareas/detalle?id=${tareaId}`);
  await expect(page.getByText(emailCliente)).toBeVisible();
  await expect(
    page.getByText(
      'Esperando que el cliente confirme el pago y finalice la tarea'
    )
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Marcar como finalizada' })
  ).toHaveCount(0);

  // El backend también lo impide.
  const r = await request.post(`${API}/api/tareas/${tareaId}/finalizar`, {
    headers: auth(tokenElegido),
    data: { pagoConfirmado: true },
  });
  expect(r.status()).toBe(403);
});

test('Esc 2 (US-014): una tarea abierta no se puede finalizar', async ({
  request,
}) => {
  const t = await request.post(`${API}/api/tareas`, {
    headers: auth(tokenCliente),
    data: {
      titulo: `${titulo} abierta`,
      descripcion: 'Tarea abierta de la prueba E2E: no debe poder finalizarse.',
      categoria: 'Limpieza',
      ubicacion: 'Envigado',
    },
  });
  const { id } = (await t.json()) as { id: string };
  const r = await request.post(`${API}/api/tareas/${id}/finalizar`, {
    headers: auth(tokenCliente),
    data: { pagoConfirmado: true },
  });
  expect(r.status()).toBe(409);
});

test('Esc 4-5 (US-014): cancelar no cambia nada y un fallo de red no finaliza', async ({
  page,
}) => {
  await entrar(page, emailCliente);
  await page.goto(`/tareas/detalle?id=${tareaId}`);
  await page.getByRole('button', { name: 'Marcar como finalizada' }).click();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.locator('.ch-badge', { hasText: 'asignada' }).first()
  ).toBeVisible();

  await page.route(`**/api/tareas/${tareaId}/finalizar`, (ruta) =>
    ruta.abort('failed')
  );
  await page.getByRole('button', { name: 'Marcar como finalizada' }).click();
  await page
    .getByRole('button', { name: 'Confirmar pago y finalizar' })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'Ocurrió un error al intentar finalizar la tarea. Verifica tu conexión e intenta de nuevo.'
  );
  await page.unroute(`**/api/tareas/${tareaId}/finalizar`);
});

test('Esc 1 (US-014): confirma el pago, finaliza y lleva a calificar al afiliado', async ({
  page,
}) => {
  await entrar(page, emailCliente);
  await page.goto(`/tareas/detalle?id=${tareaId}`);
  await page.getByRole('button', { name: 'Marcar como finalizada' }).click();
  await page
    .getByRole('button', { name: 'Confirmar pago y finalizar' })
    .click();
  await expect(
    page.getByText('Tarea completada. Gracias por usar ClicHogar')
  ).toBeVisible();
  await page.waitForURL(`**/calificaciones?tarea=${tareaId}`, {
    timeout: 10000,
  });
  await expect(
    page.getByRole('heading', { name: 'Califica el servicio' })
  ).toBeVisible();
});

test('una tarea finalizada no se puede cerrar de nuevo', async ({
  request,
}) => {
  const r = await request.post(`${API}/api/tareas/${tareaId}/finalizar`, {
    headers: auth(tokenCliente),
    data: { pagoConfirmado: true },
  });
  expect(r.status()).toBe(409);
});
