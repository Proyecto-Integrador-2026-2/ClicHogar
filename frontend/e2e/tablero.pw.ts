/**
 * E2E de la US-008 (Exploración y listado de tareas disponibles).
 * Crea su propio usuario y 13 tareas por API para no depender de datos
 * previos; no necesita `.secret`.
 */
import { expect, test, type Page } from '@playwright/test';

const API = 'http://localhost:3000';
const TAMANO_BLOQUE = 12;
const TOTAL_TAREAS = 13;
const MENSAJE_ERROR =
  'No pudimos cargar las tareas disponibles. Por favor, verifica tu conexión e intenta nuevamente';
const MENSAJE_VACIO =
  'En este momento no hay nuevas tareas publicadas. Vuelve más tarde.';

const marca = Date.now();
const email = `e2e.tablero.${marca}@example.test`;
const password = `E2e-${marca}-Tablero!`;
const titulos: string[] = [];

async function entrar(page: Page) {
  await page.goto('/login');
  await page.locator('#ch-login-email').fill(email);
  await page.locator('#ch-login-password').fill(password);
  await page.getByRole('button', { name: /Iniciar sesión/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  const registro = await request.post(`${API}/api/auth/register`, {
    data: { nombre: 'Tablero E2E', email, password, rol: 'afiliado' },
  });
  expect(registro.status()).toBe(201);
  const { token } = await registro.json();

  // Secuencial: el orden de creación define el orden esperado del tablero.
  // Las 12 primeras están cerca de Medellín; la #13 (la más reciente) en
  // Bogotá, para comprobar el filtro por zona.
  for (let n = 1; n <= TOTAL_TAREAS; n++) {
    const titulo = `US008 ${marca} #${String(n).padStart(2, '0')}`;
    const lejos = n === TOTAL_TAREAS;
    const r = await request.post(`${API}/api/tareas`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        titulo,
        descripcion:
          'Tarea creada por la prueba E2E de la US-008 para el tablero.',
        categoria: 'Limpieza',
        ubicacion: lejos ? 'Bogotá' : 'Laureles, Medellín',
        latitud: lejos ? 4.6097 : 6.2442 + (n % 3) * 0.001,
        longitud: lejos ? -74.0817 : -75.5812 + (n % 3) * 0.001,
      },
    });
    expect(r.status()).toBe(201);
    titulos.push(titulo);
  }
});

test('Esc 1-2: tarjetas con datos clave, la más reciente primero', async ({
  page,
}) => {
  await entrar(page);
  await page.goto('/tareas');
  const tarjetas = page.locator('.ch-tarea');
  await expect(tarjetas.first()).toBeVisible();
  // Lo último publicado aparece arriba.
  await expect(tarjetas.first()).toContainText(titulos[TOTAL_TAREAS - 1]!);
  await expect(tarjetas.first().locator('.ch-chip')).toHaveText('Limpieza');
  await expect(tarjetas.first()).toContainText('Bogotá');
  await expect(tarjetas.first().locator('.ch-tarea__meta')).toContainText(
    /\d{1,2}\s/
  );
  await expect(tarjetas.first().locator('.ch-badge')).toHaveText('Abierta');
});

test('Esc 5: carga el siguiente bloque al llegar al final', async ({
  page,
}) => {
  await entrar(page);
  await page.goto('/tareas');
  const tarjetas = page.locator('.ch-tarea');
  await expect(tarjetas).toHaveCount(TAMANO_BLOQUE);
  // Scroll hasta el final (dispara el centinela) o botón de respaldo.
  await page.mouse.wheel(0, 20000);
  await expect
    .poll(async () => tarjetas.count(), { timeout: 10000 })
    .toBeGreaterThan(TAMANO_BLOQUE);
});

test('Esc 4: sin tareas muestra el mensaje de tablero vacío', async ({
  page,
}) => {
  await entrar(page);
  await page.route('**/api/tareas?*', (ruta) =>
    ruta.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        tareas: [],
        pagina: 1,
        limite: 12,
        hayMas: false,
      }),
    })
  );
  await page.goto('/tareas');
  await expect(page.getByText(MENSAJE_VACIO)).toBeVisible();
});

test('Esc 6: error de red muestra el mensaje y permite reintentar', async ({
  page,
}) => {
  await entrar(page);
  await page.route('**/api/tareas?*', (ruta) => ruta.abort('failed'));
  await page.goto('/tareas');
  const alerta = page.getByRole('alert');
  await expect(alerta).toContainText(MENSAJE_ERROR);

  await page.unroute('**/api/tareas?*');
  await alerta.getByRole('button', { name: /Reintentar/i }).click();
  await expect(page.locator('.ch-tarea').first()).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('búsqueda por zona: el punto, el radio y "Ver todas" filtran el tablero', async ({
  page,
}) => {
  await entrar(page);
  await page.goto('/tareas');
  await expect(page.locator('.ch-tarea').first()).toBeVisible();

  // Abre el pop-up y comprueba que sin punto no se puede buscar.
  await page.getByRole('button', { name: 'Buscar por zona' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Buscar por zona' });
  await expect(dialogo).toBeVisible();
  const buscar = dialogo.getByRole('button', { name: 'Buscar en esta zona' });
  await expect(buscar).toBeDisabled();

  // Enter sobre el mapa coloca el punto en el centro (Medellín). Se espera a
  // que Leaflet termine de montar para que el atajo tenga efecto.
  const mapa = dialogo.getByRole('region', {
    name: 'Mapa para elegir la zona de búsqueda',
  });
  await expect(dialogo.locator('.ch-modal__mapa.leaflet-container')).toBeVisible();
  await mapa.focus();
  await mapa.press('Enter');
  await expect(dialogo.getByText(/Punto:/)).toBeVisible();
  await expect(buscar).toBeEnabled();

  // Radio de 5 km y búsqueda.
  await dialogo.getByLabel('Radio de búsqueda (km)').fill('5');
  await buscar.click();
  await expect(dialogo).toHaveCount(0);
  await expect(page).toHaveURL(/lat=.*lng=.*radio=5/);

  // La tarea de Bogotá queda fuera; las de Medellín muestran distancia.
  await expect(page.getByText(titulos[TOTAL_TAREAS - 1]!)).toHaveCount(0);
  await expect(page.getByText(titulos[0]!)).toBeVisible();
  await expect(page.locator('.ch-tarea__distancia').first()).toBeVisible();

  // "Ver todas" limpia el filtro y devuelve la tarea lejana.
  await page.getByRole('button', { name: 'Ver todas' }).click();
  await expect(page).not.toHaveURL(/radio=/);
  await expect(page.getByText(titulos[TOTAL_TAREAS - 1]!)).toBeVisible();
});
