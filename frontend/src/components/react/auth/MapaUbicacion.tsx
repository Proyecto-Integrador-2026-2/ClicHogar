/**
 * Mapa de solo lectura (Leaflet + OpenStreetMap) con la ubicación de una
 * tarea. `aproximada` dibuja una zona de 200 m en vez de un marcador exacto
 * (US-009: la ubicación se muestra aproximada a terceros).
 */
import React, { useEffect, useRef } from 'react';
import type { Map as MapaLeaflet } from 'leaflet';
import './auth.css';

type Props = {
  latitud: number;
  longitud: number;
  aproximada?: boolean;
};

/** Radio (m) de la zona que se dibuja cuando la ubicación es aproximada. */
const RADIO_ZONA_M = 200;

export default function MapaUbicacion({
  latitud,
  longitud,
  aproximada = false,
}: Readonly<Props>) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<MapaLeaflet | null>(null);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      if (cancelado || !contenedor.current) return;
      const mapa = L.map(contenedor.current);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapa);
      if (aproximada) {
        L.circle([latitud, longitud], {
          radius: RADIO_ZONA_M,
        }).addTo(mapa);
        // Los bounds se calculan sin depender de que el mapa ya haya
        // proyectado el círculo (en jsdom/happy-dom aún no hay tamaño).
        mapa.fitBounds(L.latLng(latitud, longitud).toBounds(RADIO_ZONA_M * 2), {
          padding: [24, 24],
          maxZoom: 17,
        });
      } else {
        mapa.setView([latitud, longitud], 16);
        L.marker([latitud, longitud]).addTo(mapa);
      }
      mapaRef.current = mapa;
    })();
    return () => {
      cancelado = true;
      mapaRef.current?.remove();
      mapaRef.current = null;
    };
  }, [latitud, longitud, aproximada]);

  return (
    <div
      ref={contenedor}
      className="ch-map__canvas"
      role="img"
      aria-label={
        aproximada ? 'Mapa con la zona aproximada' : 'Mapa con la ubicación'
      }
    />
  );
}
