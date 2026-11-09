/**
 * Utilidades puras del filtro por zona del tablero (US-008).
 * - Validan el radio y los parámetros de la URL.
 * - Serializan el filtro para `history.replaceState`.
 * - Calculan la distancia Haversine en el navegador para mostrarla en cada
 *   tarjeta cuando hay un filtro activo.
 * Sin DOM ni red: cubiertas por `zona.test.ts`.
 */

export type PuntoZona = { lat: number; lng: number };
export type FiltroZona = PuntoZona & { radio: number };

export const RADIO_MIN_KM = 1;
export const RADIO_MAX_KM = 100;
export const RADIO_POR_DEFECTO_KM = 2;
export const RETARDO_CIRCULO_MS = 500;

/** Radio válido: vacío => 2; entero entre 1 y 100. `null` si es inválido. */
export function validarRadio(valor: string): number | null {
  const texto = valor.trim();
  if (texto === '') return RADIO_POR_DEFECTO_KM;
  if (!/^\d+$/.test(texto)) return null;
  const numero = Number(texto);
  if (
    !Number.isInteger(numero) ||
    numero < RADIO_MIN_KM ||
    numero > RADIO_MAX_KM
  ) {
    return null;
  }
  return numero;
}

/** Número finito de un parámetro, o `null` si falta o no es válido. */
function numeroDeParametro(valor: string | null): number | null {
  if (valor === null || valor.trim() === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

/**
 * Lee lat/lng/radio de un query string. Exige los tres parámetros y que
 * estén en rango; si falta uno o no es válido devuelve `null`.
 */
export function leerFiltroZona(search: string): FiltroZona | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return null;
  }
  const lat = numeroDeParametro(params.get('lat'));
  const lng = numeroDeParametro(params.get('lng'));
  const radioTexto = params.get('radio');
  const radio = radioTexto === null ? null : validarRadio(radioTexto);
  if (lat === null || lng === null || radio === null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng, radio };
}

/** Query serializada sin `?`; cadena vacía si no hay filtro. */
export function queryZona(filtro: FiltroZona | null): string {
  if (!filtro) return '';
  const params = new URLSearchParams();
  params.set('lat', String(filtro.lat));
  params.set('lng', String(filtro.lng));
  params.set('radio', String(filtro.radio));
  return params.toString();
}

const RADIO_TIERRA_KM = 6371;

function aRadianes(grados: number): number {
  return (grados * Math.PI) / 180;
}

/** Distancia Haversine en kilómetros entre dos puntos. */
export function distanciaKm(a: PuntoZona, b: PuntoZona): number {
  const dLat = aRadianes(b.lat - a.lat);
  const dLng = aRadianes(b.lng - a.lng);
  const latA = aRadianes(a.lat);
  const latB = aRadianes(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(latA) * Math.cos(latB) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_TIERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "a 850 m", "a 2,3 km", "a 12 km". */
export function formatearDistancia(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '';
  if (km < 1) {
    const metros = Math.round((km * 1000) / 10) * 10;
    return `a ${metros} m`;
  }
  if (km < 10) {
    const valor = km.toLocaleString('es-CO', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return `a ${valor} km`;
  }
  return `a ${Math.round(km)} km`;
}
