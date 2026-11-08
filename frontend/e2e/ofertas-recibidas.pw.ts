/**
 * E2E de la US-012 (Revisión de ofertas recibidas por parte del Usuario).
 * Crea su propio cliente, dos afiliados, dos tareas, ofertas y una
 * calificación por API; no necesita `.secret`.
 */
import { expect, test, type Page } from '@playwright/test';

const API = 'http://localhost:3000';
const marca = Date.now();
const password = `E2e-${marca}-Ofertas!`;
const tituloConOfertas = `US012 ${marca} con ofertas`;
const tituloSinOfertas = `US012 ${marca} sin ofertas`;

const emailCliente = `e2e.cliente12.${marca}@example.test`;
const emailMejor = `e2e.mejor12.${marca}@example.test`;
const emailNuevo = `e2e.nuevo12.${marca}@example.test`;

let tokenCliente = '';
let tokenMejor = '';
let tokenNuevo = '';
let idMejor = '';
let tareaConOfertas = '';
let tareaSinOfertas = '';

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

async function crearTarea(
  request: Peticiones,
  token: string,
  titulo: string
): Promise<string> {
  const r = await request.post(`${API}/api/tareas`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      titulo,
      descripcion:
        'Tarea de la prueba E2E de la US-012: revisar las ofertas recibidas.',
      categoria: 'Plomería',
      ubicacion: 'Laureles, Medellín',
    },
  });
  expect(r.status()).toBe(201);
  return ((await r.json()) as { id: string }).id;
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
    'Cliente Doce',
    emailCliente,
    'cliente'
  );
  const mejor = await registrar(
    request,
    'Mejor Valorado',
    emailMejor,
    'afiliado'
  );
  const nuevo = await registrar(
    request,
    'Afiliado Nuevo',
    emailNuevo,
    'afiliado'
  );
  tokenCliente = cliente.token;
  tokenMejor = mejor.token;
  tokenNuevo = nuevo.token;
  idMejor = mejor.id;

  tareaConOfertas = await crearTarea(request, tokenCliente, tituloConOfertas);
  tareaSinOfertas = await crearTarea(request, tokenCliente, tituloSinOfertas);

  // El nuevo se postula primero y el mejor después: el orden por reputación
  // debe ganarle a la recencia.
  const oNuevo = await request.post(
    `${API}/api/tareas/${tareaConOfertas}/ofertas`,
    {
      headers: { Authorization: `Bearer ${tokenNuevo}` },
      data: { mensaje: 'Soy nuevo pero muy puntual.' },
    }
  );
  expect(oNuevo.status()).toBe(201);
  const oMejor = await request.post(
    `${API}/api/tareas/${tareaConOfertas}/ofertas`,
    {
      headers: { Authorization: `Bearer ${tokenMejor}` },
      data: { mensaje: 'Tengo 8 años de experiencia.' },
    }
  );
  expect(oMejor.status()).toBe(201);

  // Perfil, disponibilidad y una calificación del cliente al mejor.
  const perfil = await request.patch(`${API}/api/usuarios/yo`, {
    headers: { Authorization: `Bearer ${tokenMejor}` },
    multipart: { descripcion: 'Plomero con 8 años de experiencia.' },
  });
  expect(perfil.status()).toBe(200);
  const horario = await request.put(`${API}/api/usuarios/disponibilidad`, {
    headers: { Authorization: `Bearer ${tokenMejor}` },
    data: { slots: [{ dia: 1, franja: 'tarde' }] },
  });
  expect(horario.status()).toBe(200);
  const calificacion = await request.post(`${API}/api/calificaciones`, {
    headers: { Authorization: `Bearer ${tokenCliente}` },
    data: {
      destinatarioId: idMejor,
      puntuacion: 5,
      comentario: 'Excelente trabajo',
    },
  });
  expect(calificacion.status()).toBe(201);
});

test('Esc 1 y 5: desde Mis solicitudes se ven las ofertas, la mejor reputación primero', async ({
  page,
}) => {
  await entrar(page, emailCliente);
  await page.goto('/tareas/mias');
  const tarjeta = page.locator('.ch-tarea', { hasText: tituloConOfertas });
  await expect(tarjeta).toContainText('2 ofertas');
  await tarjeta.getByRole('link', { name: 'Ver ofertas' }).click();
  await page.waitForURL(new RegExp(`/tareas/detalle\\?id=${tareaConOfertas}`));

  const seccion = page.getByRole('region', { name: 'Ofertas recibidas' });
  const nombres = seccion.getByRole('heading', { level: 4 });
  await expect(nombres).toHaveText(['Mejor Valorado', 'Afiliado Nuevo']);
  await expect(
    seccion.getByRole('img', { name: /5,0 de 5 estrellas/ })
  ).toBeVisible();
  await expect(seccion.getByText('Sin calificaciones')).toBeVisible();
  await expect(
    seccion.getByText('“Tengo 8 años de experiencia.”')
  ).toBeVisible();
  await expect(
    seccion.getByText('“Soy nuevo pero muy puntual.”')
  ).toBeVisible();
});

test('Esc 2: el nombre del afiliado abre su perfil con descripción, horario y valoraciones', async ({
  page,
}) => {
  await entrar(page, emailCliente);
  await page.goto(`/tareas/detalle?id=${tareaConOfertas}`);
  await page.getByRole('link', { name: 'Mejor Valorado' }).first().click();
  await page.waitForURL(new RegExp(`/perfil/publico\\?id=${idMejor}`));

  await expect(
    page.getByRole('heading', { name: 'Mejor Valorado' })
  ).toBeVisible();
  await expect(
    page.getByText('Plomero con 8 años de experiencia.')
  ).toBeVisible();
  await expect(page.getByLabel('Lun Tarde: disponible')).toBeVisible();
  await expect(page.getByLabel('Mar Noche: no disponible')).toBeVisible();
  await expect(page.getByText('“Excelente trabajo”')).toBeVisible();
});

test('Esc 3: una tarea sin ofertas muestra el mensaje de estado vacío', async ({
  page,
}) => {
  await entrar(page, emailCliente);
  await page.goto(`/tareas/detalle?id=${tareaSinOfertas}`);
  await expect(
    page.getByText(
      'Aún no has recibido ofertas. Te notificaremos cuando un afiliado se postule para esta tarea.'
    )
  ).toBeVisible();
});

test('Esc 4: quien no es el creador no ve las ofertas ni en la pantalla ni en la API', async ({
  page,
  request,
}) => {
  await entrar(page, emailNuevo);
  await page.goto(`/tareas/detalle?id=${tareaConOfertas}`);
  await expect(
    page.getByRole('heading', { name: tituloConOfertas })
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Ofertas recibidas' })
  ).toHaveCount(0);
  await expect(page.getByText('Mejor Valorado')).toHaveCount(0);

  const r = await request.get(`${API}/api/tareas/${tareaConOfertas}/ofertas`, {
    headers: { Authorization: `Bearer ${tokenNuevo}` },
  });
  expect(r.status()).toBe(403);
  const cuerpo = (await r.json()) as { message: string };
  expect(cuerpo.message).toBe(
    'No tienes los permisos necesarios para ver las ofertas de esta tarea.'
  );
  expect(JSON.stringify(cuerpo)).not.toContain('Mejor Valorado');
});
