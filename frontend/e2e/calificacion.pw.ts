/**
 * E2E de la US-016 (Calificación del servicio y reseñas). Crea por API un
 * cliente, un afiliado y dos tareas ya finalizadas (con oferta, asignación
 * y cierre). Requiere las migraciones aplicadas (incluida 0010, que añade la
 * unicidad de la calificación por tarea).
 */
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';

const API = 'http://localhost:3000';
const marca = Date.now();
const password = `E2e-${marca}-Califica!`;
const emailCliente = `e2e.cliente16.${marca}@example.test`;
const emailAfiliado = `e2e.afiliado16.${marca}@example.test`;
const tituloA = `US016 ${marca} con reseña`;
const tituloB = `US016 ${marca} solo estrellas`;

let tokenCliente = '';
let idAfiliado = '';
let tareaA = '';
let tareaB = '';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function registrar(
  request: APIRequestContext,
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

/** Publica una tarea, recibe la oferta del afiliado, la asigna y la finaliza. */
async function tareaFinalizada(
  request: APIRequestContext,
  tokenCliente: string,
  tokenAfiliado: string,
  titulo: string
): Promise<string> {
  const t = await request.post(`${API}/api/tareas`, {
    headers: auth(tokenCliente),
    data: {
      titulo,
      descripcion:
        'Tarea de la prueba E2E de la US-016: calificar el servicio.',
      categoria: 'Plomería',
      ubicacion: 'Laureles, Medellín',
    },
  });
  expect(t.status()).toBe(201);
  const { id } = (await t.json()) as { id: string };
  const o = await request.post(`${API}/api/tareas/${id}/ofertas`, {
    headers: auth(tokenAfiliado),
    data: {},
  });
  expect(o.status()).toBe(201);
  const oferta = (await o.json()) as { id: string };
  const a = await request.post(`${API}/api/tareas/${id}/asignar`, {
    headers: auth(tokenCliente),
    data: { ofertaId: oferta.id },
  });
  expect(a.status()).toBe(200);
  const f = await request.post(`${API}/api/tareas/${id}/finalizar`, {
    headers: auth(tokenCliente),
    data: { pagoConfirmado: true },
  });
  expect(f.status()).toBe(200);
  return id;
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
    'Cliente Dieciséis',
    emailCliente,
    'cliente'
  );
  const afiliado = await registrar(
    request,
    'Afiliado Calificado',
    emailAfiliado,
    'afiliado'
  );
  tokenCliente = cliente.token;
  idAfiliado = afiliado.id;
  tareaA = await tareaFinalizada(
    request,
    tokenCliente,
    afiliado.token,
    tituloA
  );
  tareaB = await tareaFinalizada(
    request,
    tokenCliente,
    afiliado.token,
    tituloB
  );
});

test('Esc 6: la calificación pendiente aparece en Mis solicitudes y se puede retomar o aplazar', async ({
  page,
}) => {
  await entrar(page, emailCliente);
  await page.goto('/tareas/mias');
  const tarjeta = page.locator('.ch-tarea', { hasText: tituloA });
  await expect(tarjeta).toContainText('Tienes una calificación pendiente');
  await tarjeta.getByRole('link', { name: 'Calificar ahora' }).click();
  await page.waitForURL(new RegExp(`/calificaciones\\?tarea=${tareaA}`));
  await expect(
    page.getByRole('heading', { name: 'Califica el servicio' })
  ).toBeVisible();

  // Aplazar: vuelve a Mis solicitudes y la pendiente sigue ahí.
  await page.getByRole('link', { name: 'Calificar más tarde' }).click();
  await page.waitForURL(/\/tareas\/mias/);
  await expect(page.locator('.ch-tarea', { hasText: tituloA })).toContainText(
    'Tienes una calificación pendiente'
  );
});

test('Esc 3 y 4: sin estrellas no envía y la reseña tiene tope de 500', async ({
  page,
}) => {
  await entrar(page, emailCliente);
  await page.goto(`/calificaciones?tarea=${tareaA}`);
  await page.getByLabel(/Reseña/).fill('x'.repeat(600));
  // Esc 4: la entrada se bloquea en 500 caracteres.
  await expect(page.getByLabel(/Reseña/)).toHaveValue('x'.repeat(500));
  await expect(page.getByText('500/500')).toBeVisible();

  // Esc 3: sin estrellas no se envía y se resalta la sección.
  await page.getByRole('button', { name: 'Enviar calificación' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Por favor, selecciona una calificación de estrellas para continuar'
  );
  await expect(page.getByRole('radiogroup')).toHaveClass(
    /ch-estrellas-input--error/
  );
  await expect(page.getByRole('status')).toHaveCount(0);
});

test('Esc 1 y 5: califica con estrellas y reseña, y no se puede calificar dos veces', async ({
  page,
  request,
}) => {
  await entrar(page, emailCliente);
  await page.goto(`/calificaciones?tarea=${tareaA}`);
  await page.getByRole('radio', { name: '5 estrellas' }).click();
  await page.getByLabel(/Reseña/).fill('Excelente trabajo, muy puntual.');
  await page.getByRole('button', { name: 'Enviar calificación' }).click();
  await expect(
    page.getByText(
      'Gracias por calificar el servicio. Tu opinión ayuda a la comunidad.'
    )
  ).toBeVisible();

  // Vinculada al perfil del afiliado.
  await page
    .getByRole('link', { name: /Ver el perfil de Afiliado Calificado/ })
    .click();
  await page.waitForURL(new RegExp(`/perfil/publico\\?id=${idAfiliado}`));
  await expect(
    page.getByText('“Excelente trabajo, muy puntual.”')
  ).toBeVisible();

  // Esc 5: volver a la URL del formulario está bloqueado.
  await page.goto(`/calificaciones?tarea=${tareaA}`);
  await expect(
    page.getByText(
      'Ya has enviado tu valoración para esta tarea anteriormente.'
    )
  ).toBeVisible();
  await expect(page.getByRole('radiogroup')).toHaveCount(0);
  const segunda = await request.post(`${API}/api/calificaciones`, {
    headers: auth(tokenCliente),
    data: { tareaId: tareaA, puntuacion: 1 },
  });
  expect(segunda.status()).toBe(409);

  // Ya no queda pendiente en Mis solicitudes.
  await page.goto('/tareas/mias');
  await expect(
    page.locator('.ch-tarea', { hasText: tituloA })
  ).not.toContainText('calificación pendiente');
});

test('Esc 2: una calificación solo numérica se guarda sin reseña', async ({
  page,
  request,
}) => {
  await entrar(page, emailCliente);
  await page.goto(`/calificaciones?tarea=${tareaB}`);
  await page.getByRole('radio', { name: '4 estrellas' }).click();
  await page.getByRole('button', { name: 'Enviar calificación' }).click();
  await expect(
    page.getByText(
      'Gracias por calificar el servicio. Tu opinión ayuda a la comunidad.'
    )
  ).toBeVisible();

  const lista = await request.get(
    `${API}/api/calificaciones/usuario/${idAfiliado}`
  );
  const calificaciones = (await lista.json()) as Array<{
    tarea_id: string;
    puntuacion: number;
    comentario: string | null;
  }>;
  const guardada = calificaciones.find((c) => c.tarea_id === tareaB);
  expect(guardada?.puntuacion).toBe(4);
  expect(guardada?.comentario).toBeNull();
});

test('el afiliado no puede calificar su propio servicio ni una tarea ajena', async ({
  request,
}) => {
  const login = await request.post(`${API}/api/auth/login`, {
    data: { email: emailAfiliado, password },
  });
  const { token } = (await login.json()) as { token: string };
  const r = await request.post(`${API}/api/calificaciones`, {
    headers: auth(token),
    data: { tareaId: tareaA, puntuacion: 5 },
  });
  expect(r.status()).toBe(403);
});
