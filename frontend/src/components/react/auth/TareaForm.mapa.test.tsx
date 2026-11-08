/**
 * Pruebas del mapa y de las coordenadas de TareaForm: geolocalización,
 * arrastre del marcador y edición manual de latitud/longitud. Leaflet corre
 * sobre happy-dom; solo se envuelve `L.marker` para alcanzar el marcador.
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import L from 'leaflet';
import React from 'react';
import { resetSesion } from '../../../../test-setup';
import TareaForm from './TareaForm';

type Geo = {
  getCurrentPosition: (
    ok: (pos: { coords: { latitude: number; longitude: number } }) => void,
    error: () => void
  ) => void;
};

/** Define (o quita) `navigator.geolocation`, que es de solo lectura. */
function simularGeolocalizacion(geo: Geo | undefined) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: geo,
  });
}

beforeEach(resetSesion);

afterEach(() => {
  cleanup();
  simularGeolocalizacion(undefined);
  spyOn(L, 'marker').mockRestore();
});

const latitud = () =>
  (document.getElementById('ch-tarea-latitud') as HTMLInputElement).value;
const longitud = () =>
  (document.getElementById('ch-tarea-longitud') as HTMLInputElement).value;

describe('TareaForm: mapa y coordenadas', () => {
  test('con geolocalización el mapa arranca en la posición del usuario', () => {
    // Given: un navegador que entrega la posición del usuario
    simularGeolocalizacion({
      getCurrentPosition: (ok) =>
        ok({ coords: { latitude: 6.2, longitude: -75.5 } }),
    });
    // When: se renderiza el formulario
    render(<TareaForm />);
    // Then: latitud y longitud toman esa posición
    expect(latitud()).toBe('6.2');
    expect(longitud()).toBe('-75.5');
  });

  test('si la geolocalización falla usa Bogotá', () => {
    // Given: un navegador que rechaza el permiso de ubicación
    simularGeolocalizacion({
      getCurrentPosition: (_ok, error) => error(),
    });
    // When: se renderiza el formulario
    render(<TareaForm />);
    // Then: arranca en Bogotá
    expect(latitud()).toBe('4.6097');
    expect(longitud()).toBe('-74.0817');
  });

  test('arrastrar el marcador actualiza latitud y longitud', () => {
    // Given: un formulario con el mapa listo y el marcador accesible
    const real = L.marker;
    let marcador: L.Marker | undefined;
    spyOn(L, 'marker').mockImplementation(((
      ...args: Parameters<typeof real>
    ) => {
      marcador = real(...args);
      return marcador;
    }) as typeof real);
    render(<TareaForm />);
    // When: se arrastra el marcador a otro punto
    act(() => {
      marcador!.fire('dragstart');
      marcador!.setLatLng([6.25, -75.57]);
      marcador!.fire('dragend');
    });
    // Then: los campos reflejan el nuevo punto
    expect(latitud()).toBe('6.25');
    expect(longitud()).toBe('-75.57');
  });

  test('los campos de coordenadas se editan a mano y se pueden vaciar', () => {
    // Given: un formulario con coordenadas iniciales
    render(<TareaForm />);
    // When: se escriben coordenadas manualmente
    fireEvent.change(screen.getByLabelText(/Latitud/), {
      target: { value: '1.5' },
    });
    fireEvent.change(screen.getByLabelText(/Longitud/), {
      target: { value: '-2.5' },
    });
    // Then: quedan en los campos
    expect(latitud()).toBe('1.5');
    expect(longitud()).toBe('-2.5');
    // When: se vacían
    fireEvent.change(screen.getByLabelText(/Latitud/), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText(/Longitud/), {
      target: { value: '' },
    });
    // Then: quedan vacíos
    expect(latitud()).toBe('');
    expect(longitud()).toBe('');
  });
});
