/**
 * Tablero de solicitudes abiertas (US-008): lista centralizada para
 * comparar y elegir tareas.
 * - Esc 1-2: tarjetas con título, categoría, ubicación y fecha; el backend
 *   las entrega de la más reciente a la más antigua.
 * - Esc 3: solo llegan tareas abiertas (el backend excluye asignadas y
 *   finalizadas).
 * - Esc 4: estado vacío con mensaje explícito.
 * - Esc 5: carga progresiva por bloques (scroll infinito con respaldo
 *   manual "Cargar más").
 * - Esc 6: error de red/timeout con mensaje claro y reintento.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as MapaLeaflet } from 'leaflet';
import { estaFirmado, obtenerToken } from '../../../lib/auth';
import {
  ErrorSesionExpirada,
  listarTareas,
  obtenerPerfilPublico,
  type TareaTablero,
  type UsuarioPublico,
} from '../../../lib/usuarios-api';
import './auth.css';
import {
  AlertaConReintento,
  PantallaCargando,
  PantallaSinSesion,
} from './carga-sesion';

export const MENSAJE_TABLERO_VACIO =
  'En este momento no hay nuevas tareas publicadas. Vuelve más tarde.';
export const MENSAJE_ERROR_TABLERO =
  'No pudimos cargar las tareas disponibles. Por favor, verifica tu conexión e intenta nuevamente';
const MENSAJE_FILTRO_INVALIDO = 'Ingresa latitud, longitud y radio válidos.';

/** Tareas por bloque: el backend limita el máximo a 50. */
const TAMANO_BLOQUE = 12;

type Cercania = { lat: number; lng: number; radio: number };

function fechaCorta(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  return fecha.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
  });
}

/** Lee los campos de cercanía; `null` si alguno no es un número válido. */
function leerCercania(
  lat: string,
  lng: string,
  radio: string
): Cercania | null {
  const valores = [lat, lng, radio].map((v) =>
    v.trim() === '' ? Number.NaN : Number(v)
  );
  const [la, lo, ra] = valores as [number, number, number];
  if (!valores.every(Number.isFinite) || ra <= 0) return null;
  if (Math.abs(la) > 90 || Math.abs(lo) > 180) return null;
  return { lat: la, lng: lo, radio: ra };
}

export default function TableroTareas() {
  const [tareas, setTareas] = useState<TareaTablero[]>([]);
  const [pagina, setPagina] = useState(0);
  const [hayMas, setHayMas] = useState(false);
  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState(false);
  const [cercania, setCercania] = useState<Cercania | null>(null);

  const [filtroLat, setFiltroLat] = useState('');
  const [filtroLng, setFiltroLng] = useState('');
  const [filtroRadio, setFiltroRadio] = useState('10');
  const [errorFiltro, setErrorFiltro] = useState('');

  const [expandida, setExpandida] = useState<TareaTablero | null>(null);
  const [perfilAutor, setPerfilAutor] = useState<UsuarioPublico | null>(null);
  const mapaRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<MapaLeaflet | null>(null);
  const centinelaRef = useRef<HTMLLIElement>(null);

  // Descarta respuestas de peticiones antiguas (cambio de filtro o
  // reintento mientras otra seguía en vuelo).
  const peticionRef = useRef(0);

  /**
   * Trae una página. `reemplazar` reinicia la lista (carga inicial o
   * filtro nuevo); si no, la añade al final. Un 401 va a /login.
   */
  const cargarPagina = useCallback(
    async (siguiente: number, filtro: Cercania | null, reemplazar: boolean) => {
      const id = ++peticionRef.current;
      setError(false);
      if (reemplazar) setCargandoInicial(true);
      else setCargandoMas(true);
      try {
        const token = obtenerToken();
        if (!token) throw new ErrorSesionExpirada();
        const resultado = await listarTareas(token, {
          pagina: siguiente,
          limite: TAMANO_BLOQUE,
          ...filtro,
        });
        if (id !== peticionRef.current) return;
        setTareas((previas) =>
          reemplazar ? resultado.tareas : [...previas, ...resultado.tareas]
        );
        setPagina(resultado.pagina);
        setHayMas(resultado.hayMas);
      } catch (err: unknown) {
        if (id !== peticionRef.current) return;
        if (err instanceof ErrorSesionExpirada) {
          window.location.href = '/login?expirada=1';
          return;
        }
        setError(true);
      } finally {
        if (id === peticionRef.current) {
          setCargandoInicial(false);
          setCargandoMas(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (!estaFirmado()) {
      setCargandoInicial(false);
      return;
    }
    void cargarPagina(1, null, true);
  }, [cargarPagina]);

  const cargarSiguiente = useCallback(() => {
    if (cargandoInicial || cargandoMas || !hayMas || error) return;
    void cargarPagina(pagina + 1, cercania, false);
  }, [
    cargandoInicial,
    cargandoMas,
    hayMas,
    error,
    pagina,
    cercania,
    cargarPagina,
  ]);

  // Scroll infinito: al asomar el centinela al final de la lista se pide
  // el siguiente bloque. Sin IntersectionObserver queda el botón manual.
  useEffect(() => {
    const centinela = centinelaRef.current;
    if (!centinela || typeof IntersectionObserver === 'undefined') return;
    const observador = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) cargarSiguiente();
    });
    observador.observe(centinela);
    return () => observador.disconnect();
  }, [cargarSiguiente, tareas.length, hayMas]);

  const reintentar = () => {
    // Si falló el primer bloque se repite desde la página 1; si falló uno
    // posterior se reintenta solo ese (la lista ya cargada se conserva).
    const fallo1 = tareas.length === 0;
    void cargarPagina(fallo1 ? 1 : pagina + 1, cercania, fallo1);
  };

  const aplicarFiltro = () => {
    const nueva = leerCercania(filtroLat, filtroLng, filtroRadio);
    if (!nueva) {
      setErrorFiltro(MENSAJE_FILTRO_INVALIDO);
      return;
    }
    setErrorFiltro('');
    setCercania(nueva);
    void cargarPagina(1, nueva, true);
  };

  const limpiarFiltro = () => {
    setErrorFiltro('');
    setFiltroLat('');
    setFiltroLng('');
    setFiltroRadio('10');
    setCercania(null);
    void cargarPagina(1, null, true);
  };

  useEffect(() => {
    if (!expandida) {
      setPerfilAutor(null);
      return;
    }
    let cancelado = false;
    obtenerPerfilPublico(expandida.autorId)
      .then((perfil) => {
        if (!cancelado) setPerfilAutor(perfil);
      })
      .catch(() => {
        if (!cancelado) setPerfilAutor(null);
      });
    return () => {
      cancelado = true;
    };
  }, [expandida]);

  useEffect(() => {
    if (!expandida || !expandida.latitud || !expandida.longitud) return;
    if (!mapaRef.current) return;
    const { latitud, longitud } = expandida;
    let cancelado = false;
    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      if (cancelado || !mapaRef.current) return;
      mapInstanceRef.current?.remove();
      const mapa = L.map(mapaRef.current).setView([latitud, longitud], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapa);
      L.marker([latitud, longitud]).addTo(mapa);
      mapInstanceRef.current = mapa;
    })();
    return () => {
      cancelado = true;
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
  }, [expandida]);

  const firmado = estaFirmado();

  if (cargandoInicial && tareas.length === 0 && !cercania) {
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

  const sinResultados =
    !cargandoInicial && !error && tareas.length === 0 && pagina > 0;

  return (
    <div className="ch-auth">
      <div className="ch-card">
        <h2 className="ch-card__title">Tareas disponibles</h2>
        <p className="ch-card__subtitle">
          {tareas.length > 0
            ? `${tareas.length}${hayMas ? '+' : ''} ${tareas.length === 1 && !hayMas ? 'solicitud activa' : 'solicitudes activas'}`
            : ''}
        </p>

        <div className="ch-filtro">
          <input
            className="ch-input"
            placeholder="Lat"
            aria-label="Latitud"
            value={filtroLat}
            onChange={(e) => setFiltroLat(e.target.value)}
          />
          <input
            className="ch-input"
            placeholder="Lng"
            aria-label="Longitud"
            value={filtroLng}
            onChange={(e) => setFiltroLng(e.target.value)}
          />
          <input
            className="ch-input"
            placeholder="Radio km"
            aria-label="Radio en kilómetros"
            value={filtroRadio}
            onChange={(e) => setFiltroRadio(e.target.value)}
          />
          <button
            type="button"
            className="ch-btn ch-btn--ghost"
            onClick={aplicarFiltro}
          >
            Filtrar por cercanía
          </button>
          <button
            type="button"
            className="ch-btn ch-btn--ghost"
            onClick={limpiarFiltro}
          >
            Limpiar
          </button>
        </div>
        {errorFiltro && (
          <p className="ch-field__error" role="alert">
            {errorFiltro}
          </p>
        )}

        {cargandoInicial && (
          <p className="ch-status" role="status">
            Cargando tareas disponibles…
          </p>
        )}

        {error && (
          <AlertaConReintento
            mensaje={MENSAJE_ERROR_TABLERO}
            onReintentar={reintentar}
          />
        )}

        {sinResultados && (
          <p className="ch-field__hint">
            {cercania
              ? 'No hay tareas abiertas dentro de ese radio.'
              : MENSAJE_TABLERO_VACIO}
          </p>
        )}

        {tareas.length > 0 && (
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
            {hayMas && <li ref={centinelaRef} aria-hidden="true" />}
          </ul>
        )}

        {tareas.length > 0 && hayMas && !error && (
          <button
            type="button"
            className="ch-btn ch-btn--ghost"
            onClick={cargarSiguiente}
            disabled={cargandoMas}
          >
            {cargandoMas ? 'Cargando…' : 'Cargar más tareas'}
          </button>
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
                  {perfilAutor.descripcion
                    ? ` · ${perfilAutor.descripcion}`
                    : ''}
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
