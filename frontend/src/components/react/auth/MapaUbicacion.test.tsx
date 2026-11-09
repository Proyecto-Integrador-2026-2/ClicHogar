/**
 * Pruebas de MapaUbicacion: Leaflet sobre happy-dom; marcador exacto o zona
 * aproximada y limpieza al desmontar.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import MapaUbicacion from './MapaUbicacion';

afterEach(cleanup);

describe('MapaUbicacion', () => {
  test('exacto: dibuja el mapa con un marcador', async () => {
    // Given: coordenadas exactas
    // When: se renderiza
    render(<MapaUbicacion latitud={6.2442} longitud={-75.5812} />);
    const mapa = screen.getByRole('img', { name: 'Mapa con la ubicación' });
    // Then: aparece el mapa con su marcador
    await waitFor(() =>
      expect(mapa.querySelector('.leaflet-marker-icon')).not.toBeNull()
    );
  });

  test('aproximado: dibuja la zona en vez del marcador', async () => {
    // Given: una ubicación aproximada
    // When: se renderiza
    render(<MapaUbicacion latitud={6.24} longitud={-75.58} aproximada />);
    const mapa = screen.getByRole('img', {
      name: 'Mapa con la zona aproximada',
    });
    // Then: aparece el mapa sin marcador exacto y con la zona dibujada
    await waitFor(() =>
      expect(mapa.classList.contains('leaflet-container')).toBe(true)
    );
    await waitFor(() =>
      expect(mapa.querySelector('.leaflet-overlay-pane path')).not.toBeNull()
    );
    expect(mapa.querySelector('.leaflet-marker-icon')).toBeNull();
  });

  test('si se desmonta antes de cargar Leaflet no falla', async () => {
    // Given: un mapa que se desmonta de inmediato
    const { unmount } = render(<MapaUbicacion latitud={1} longitud={2} />);
    // When: se desmonta antes de que termine la carga asíncrona
    unmount();
    await new Promise((r) => setTimeout(r, 50));
    // Then: no hay errores ni mapa residual
    expect(document.querySelector('.leaflet-container')).toBeNull();
  });
});
