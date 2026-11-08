import React, { useCallback, useEffect, useRef, useState } from 'react';
import { listarTareas, type TareaTablero } from '../../../lib/usuarios-api';
import './auth.css';
import {
  AlertaConReintento,
  PantallaCargando,
  PantallaSinSesion,
  useCargaConSesion,
} from './carga-sesion';

function fechaCorta(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  return fecha.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
  });
}

export default function TableroTareas() {
  const [expandida, setExpandida] = useState<TareaTablero | null>(null);
  const [filtroLat, setFiltroLat] = useState('');
  const [filtroLng, setFiltroLng] = useState('');
  const [filtroRadio, setFiltroRadio] = useState('10');
  const [aplicarFiltro, setAplicarFiltro] = useState(false);
  const [perfilAutor, setPerfilAutor] = useState<any>(null);
  const mapaRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const cargarTablero = useCallback((token: string) =>
    listarTareas(token, aplicarFiltro ? {
      lat: filtroLat ? Number(filtroLat) : undefined,
      lng: filtroLng ? Number(filtroLng) : undefined,
      radio: filtroRadio ? Number(filtroRadio) : undefined,
    } : undefined),
    [aplicarFiltro, filtroLat, filtroLng, filtroRadio]
  );

  const {
    datos: tareas,
    error,
    recargar,
    firmado,
    cargando,
  } = useCargaConSesion(cargarTablero, 'No se pudo cargar el tablero.');

  useEffect(() => {
    if (!expandida) {
      setPerfilAutor(null);
      return;
    }
    (async () => {
      try {
        const { obtenerPerfilPublico } = await import('../../../lib/usuarios-api');
        setPerfilAutor(await obtenerPerfilPublico(expandida.autorId));
      } catch {
        setPerfilAutor(null);
      }
    })();
  }, [expandida]);

  useEffect(() => {
    if (!expandida || !expandida.latitud || !expandida.longitud) return;
    if (!mapaRef.current) return;
    let cancelled = false;
    (async () => {
      const mod = await import('leaflet');
      const L = mod.default;
      await import('leaflet/dist/leaflet.css');
      if (cancelled || !mapaRef.current) return;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      const map = L.map(mapaRef.current).setView([expandida.latitud!, expandida.longitud!], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
      L.marker([expandida.latitud!, expandida.longitud!]).addTo(map);
      mapInstanceRef.current = map;
    })();
    return () => {
      cancelled = true;
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
  }, [expandida]);

  if (cargando) {
    return <PantallaCargando texto="Cargando tareas disponibles…" />;
  }

  if (!firmado) {
    return (
      <PantallaSinSesion
        titulo="Explora tareas"
        subtitulo="Inicia sesión para ver las solicitudes activas y ofertar."
      />
    );
  }

  return (
    <div className="ch-auth">
      <div className="ch-card">
        <h2 className="ch-card__title">Tareas disponibles</h2>
        <p className="ch-card__subtitle">
          {tareas === null
            ? ''
            : tareas.length === 0
              ? 'Aún no hay solicitudes abiertas'
              : `${tareas.length} ${tareas.length === 1 ? 'solicitud activa' : 'solicitudes activas'}`}
        </p>

        {error && (
          <AlertaConReintento
            mensaje={error}
            onReintentar={() => void recargar()}
          />
        )}

        <div className="ch-filtro">
          <input className="ch-input" placeholder="Lat" value={filtroLat} onChange={(e) => setFiltroLat(e.target.value)} />
          <input className="ch-input" placeholder="Lng" value={filtroLng} onChange={(e) => setFiltroLng(e.target.value)} />
          <input className="ch-input" placeholder="Radio km" value={filtroRadio} onChange={(e) => setFiltroRadio(e.target.value)} />
          <button type="button" className="ch-btn ch-btn--ghost" onClick={() => { setAplicarFiltro(true); void recargar(); }}>
            Filtrar por cercanía
          </button>
          <button type="button" className="ch-btn ch-btn--ghost" onClick={() => { setAplicarFiltro(false); setFiltroLat(''); setFiltroLng(''); void recargar(); }}>
            Limpiar
          </button>
        </div>

        {tareas !== null && tareas.length === 0 && !error && (
          <p className="ch-field__hint">
            No hay tareas abiertas por ahora. Vuelve más tarde.
          </p>
        )}

        {tareas !== null && tareas.length > 0 && (
          <ul className="ch-tareas">
            {tareas.map((tarea) => (
              <li className="ch-tarea" key={tarea.id}>
                <div className="ch-tarea__head">
                  <h3 className="ch-tarea__titulo">{tarea.titulo}</h3>
                  <span className="ch-chip">{tarea.categoria}</span>
                </div>
                <p className="ch-tarea__meta">
                  {tarea.ubicacion} · {tarea.autorNombre}
                  {fechaCorta(tarea.creadoEn)
                    ? ` · ${fechaCorta(tarea.creadoEn)}`
                    : ''}
                </p>
                <p className="ch-tarea__descripcion">{tarea.descripcion}</p>
                <div className="ch-tarea__actions">
                  <span className="ch-badge">Abierta</span>
                  <button
                    type="button"
                    className="ch-btn ch-btn--ghost"
                    onClick={() => setExpandida(tarea)}
                  >
                    Ver detalle
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {expandida && (
          <div className="ch-modal" role="dialog" aria-modal="true">
            <div className="ch-modal__card">
              <h3 className="ch-card__title">{expandida.titulo}</h3>
              <p className="ch-card__subtitle">
                {expandida.categoria} · {expandida.autorNombre}
              </p>
              <p>{expandida.descripcion}</p>
              <p className="ch-tarea__meta">{expandida.ubicacion}</p>
              {perfilAutor && (
                <p className="ch-tarea__meta">
                  Autor: {perfilAutor.nombre}
                  {perfilAutor.descripcion ? ` · ${perfilAutor.descripcion}` : ''}
                  {perfilAutor.ubicacion ? ` · ${perfilAutor.ubicacion}` : ''}
                </p>
              )}
              {expandida.latitud && expandida.longitud ? (
                <div ref={mapaRef} className="ch-map__canvas" />
              ) : (
                <p className="ch-field__hint">Sin ubicación exacta.</p>
              )}
              <button
                type="button"
                className="ch-btn ch-btn--primary"
                onClick={() => setExpandida(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}