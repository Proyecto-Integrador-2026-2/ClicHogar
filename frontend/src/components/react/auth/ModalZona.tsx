/**
 * Pop-up "Buscar por zona" del tablero (US-008).
 * - Mapa Leaflet con clic y marcador arrastrable.
 * - El círculo rojo semitransparente aparece 500 ms después del último
 *   cambio (punto o radio) para no redibujar en cada arrastre.
 * - El radio es un entero de 1 a 100 km; vacío = 2 km.
 * - Se monta en un portal sobre `document.body` para que el
 *   `backdrop-filter` de las tarjetas no rompa `position: fixed`.
 */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Circle, Map as MapaLeaflet, Marker } from 'leaflet';
import './auth.css';
import {
  RETARDO_CIRCULO_MS,
  validarRadio,
  type FiltroZona,
  type PuntoZona,
} from '../../../lib/zona';

type Props = {
  filtroInicial: FiltroZona | null;
  onBuscar: (filtro: FiltroZona) => void;
  onCerrar: () => void;
};

type LeafletApi = {
  circle: typeof import('leaflet').circle;
  latLng: typeof import('leaflet').latLng;
  marker: typeof import('leaflet').marker;
};

const CENTRO_MEDELLIN: PuntoZona = { lat: 6.2442, lng: -75.5812 };
const MENSAJE_RADIO_INVALIDO =
  'El radio debe ser un número entero entre 1 y 100 km.';

export default function ModalZona({
  filtroInicial,
  onBuscar,
  onCerrar,
}: Readonly<Props>) {
  const [punto, setPunto] = useState<PuntoZona | null>(
    filtroInicial ? { lat: filtroInicial.lat, lng: filtroInicial.lng } : null
  );
  const [radio, setRadio] = useState(
    filtroInicial ? String(filtroInicial.radio) : ''
  );
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);

  const contenedor = useRef<HTMLDivElement>(null);
  const tarjeta = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<MapaLeaflet | null>(null);
  const leafletRef = useRef<LeafletApi | null>(null);
  const marcadorRef = useRef<Marker | null>(null);
  const circuloRef = useRef<Circle | null>(null);
  const temporizadorRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bloquea el scroll del body mientras el diálogo está abierto.
  useEffect(() => {
    const overflowOriginal = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflowOriginal;
    };
  }, []);

  // Foco inicial en la tarjeta del diálogo.
  useEffect(() => {
    const espera = setTimeout(() => tarjeta.current?.focus(), 0);
    return () => clearTimeout(espera);
  }, []);

  // Escape cierra el diálogo.
  useEffect(() => {
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  // Monta el mapa una sola vez.
  useEffect(() => {
    let cancelado = false;
    void (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      if (cancelado || !contenedor.current) return;
      const centro = filtroInicial
        ? [filtroInicial.lat, filtroInicial.lng]
        : [CENTRO_MEDELLIN.lat, CENTRO_MEDELLIN.lng];
      const mapa = L.map(contenedor.current, {
        center: [centro[0], centro[1]],
        zoom: 12,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapa);
      mapa.on('click', (evento) => {
        setPunto({ lat: evento.latlng.lat, lng: evento.latlng.lng });
      });
      leafletRef.current = L;
      mapaRef.current = mapa;
      setTimeout(() => mapa.invalidateSize(), 0);
      setListo(true);
    })();
    return () => {
      cancelado = true;
      if (temporizadorRef.current) clearTimeout(temporizadorRef.current);
      marcadorRef.current?.remove();
      marcadorRef.current = null;
      circuloRef.current?.remove();
      circuloRef.current = null;
      mapaRef.current?.remove();
      mapaRef.current = null;
      leafletRef.current = null;
    };
  }, [filtroInicial]);

  // Mantiene el marcador sincronizado con el punto (sin tocar el círculo).
  useEffect(() => {
    const mapa = mapaRef.current;
    const L = leafletRef.current;
    if (!mapa || !L || !listo) return;
    if (!punto) {
      marcadorRef.current?.remove();
      marcadorRef.current = null;
      return;
    }
    if (marcadorRef.current) {
      marcadorRef.current.setLatLng([punto.lat, punto.lng]);
      return;
    }
    const marcador = L.marker([punto.lat, punto.lng], {
      draggable: true,
    }).addTo(mapa);
    marcador.on('dragend', () => {
      const posicion = marcador.getLatLng();
      setPunto({ lat: posicion.lat, lng: posicion.lng });
    });
    marcadorRef.current = marcador;
  }, [punto, listo]);

  // Círculo rojo con debounce de 500 ms.
  useEffect(() => {
    const mapa = mapaRef.current;
    const L = leafletRef.current;
    if (!mapa || !L || !listo) return;
    if (temporizadorRef.current) clearTimeout(temporizadorRef.current);
    circuloRef.current?.remove();
    circuloRef.current = null;
    if (!punto) return;
    const radioKm = validarRadio(radio);
    if (radioKm === null) return;
    temporizadorRef.current = setTimeout(() => {
      const circulo = L.circle([punto.lat, punto.lng], {
        radius: radioKm * 1000,
        color: '#dc2626',
        fillColor: '#dc2626',
        fillOpacity: 0.16,
        weight: 2,
        interactive: false,
      }).addTo(mapa);
      circuloRef.current = circulo;
      // Sin `circulo.getBounds()`: depende de que el mapa ya tenga tamaño.
      mapa.fitBounds(
        L.latLng(punto.lat, punto.lng).toBounds(radioKm * 1000 * 2),
        { padding: [24, 24], maxZoom: 17 }
      );
    }, RETARDO_CIRCULO_MS);
    return () => {
      if (temporizadorRef.current) clearTimeout(temporizadorRef.current);
    };
  }, [punto, radio, listo]);

  const colocarEnCentro = () => {
    const mapa = mapaRef.current;
    if (!mapa) return;
    const centro = mapa.getCenter();
    setPunto({ lat: centro.lat, lng: centro.lng });
  };

  const alTeclearMapa = (evento: React.KeyboardEvent<HTMLDivElement>) => {
    if (evento.key !== 'Enter' && evento.key !== ' ') return;
    evento.preventDefault();
    colocarEnCentro();
  };

  const alEnviar = (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!punto) return;
    const radioKm = validarRadio(radio);
    if (radioKm === null) {
      setError(MENSAJE_RADIO_INVALIDO);
      return;
    }
    setError('');
    onBuscar({ ...punto, radio: radioKm });
  };

  const alCambiarRadio = (valor: string) => {
    setRadio(valor);
    if (error) setError('');
  };

  const alClicFondo = (evento: React.MouseEvent<HTMLDivElement>) => {
    if (evento.target === evento.currentTarget) onCerrar();
  };

  return createPortal(
    <div
      className="ch-auth ch-modal ch-modal--zona"
      onClick={alClicFondo}
      role="presentation"
    >
      <div
        ref={tarjeta}
        className="ch-card ch-modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ch-modal-zona-titulo"
        tabIndex={-1}
      >
        <h2 className="ch-card__title" id="ch-modal-zona-titulo">
          Buscar por zona
        </h2>
        <p className="ch-card__subtitle">
          Haz clic en el mapa o arrastra el marcador para elegir el centro de
          búsqueda.
        </p>

        <div
          ref={contenedor}
          className="ch-map__canvas ch-modal__mapa"
          role="region"
          aria-label="Mapa para elegir la zona de búsqueda"
          tabIndex={0}
          onKeyDown={alTeclearMapa}
        />

        <p className="ch-tarea__meta ch-modal__punto" aria-live="polite">
          {punto
            ? `Punto: ${punto.lat.toFixed(5)}, ${punto.lng.toFixed(5)}`
            : 'Sin punto seleccionado'}
        </p>

        <form onSubmit={alEnviar} noValidate>
          <div className="ch-modal__radio">
            <label className="ch-field__label" htmlFor="ch-zona-radio">
              Radio de búsqueda (km)
            </label>
            <input
              id="ch-zona-radio"
              className="ch-field__input"
              type="number"
              min={1}
              max={100}
              step={1}
              inputMode="numeric"
              placeholder="2"
              value={radio}
              onChange={(evento) => alCambiarRadio(evento.target.value)}
            />
            <p className="ch-field__hint">Vacío = 2 km. Entre 1 y 100 km.</p>
            {error && (
              <p className="ch-field__error" role="alert">
                {error}
              </p>
            )}
          </div>

          <div className="ch-modal__acciones">
            <button
              type="button"
              className="ch-btn ch-btn--ghost"
              onClick={onCerrar}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="ch-btn ch-btn--primary"
              disabled={!punto}
            >
              Buscar en esta zona
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
