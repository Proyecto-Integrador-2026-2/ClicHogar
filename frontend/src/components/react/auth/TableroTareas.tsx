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
 * - Acceso: exclusivo para afiliados, con el mismo aviso de
 *   `/perfil/disponibilidad`. El detalle sigue abierto por enlace.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { estaFirmado, obtenerToken } from '../../../lib/auth';
import {
  ErrorSesionExpirada,
  listarTareas,
  obtenerPerfil,
  type RolBackend,
  type TareaTablero,
} from '../../../lib/usuarios-api';
import './auth.css';
import {
  AlertaConReintento,
  PantallaCargando,
  PantallaSinSesion,
} from './carga-sesion';
import ModalZona from './ModalZona';
import {
  distanciaKm,
  formatearDistancia,
  leerFiltroZona,
  queryZona,
  type FiltroZona,
} from '../../../lib/zona';

export const MENSAJE_TABLERO_VACIO =
  'En este momento no hay nuevas tareas publicadas. Vuelve más tarde.';
export const MENSAJE_ERROR_TABLERO =
  'No pudimos cargar las tareas disponibles. Por favor, verifica tu conexión e intenta nuevamente';
export const MENSAJE_ERROR_PERFIL =
  'No pudimos verificar tu perfil. Por favor, verifica tu conexión e intenta nuevamente';
export const MENSAJE_SOLO_AFILIADOS =
  'Esta sección es exclusiva para perfiles de Afiliados.';

/** Tareas por bloque: el backend limita el máximo a 50. */
const TAMANO_BLOQUE = 12;

function fechaCorta(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  return fecha.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
  });
}

/** Escribe el filtro en la URL sin añadir entradas al historial. */
function sincronizarUrl(filtro: FiltroZona | null): void {
  try {
    const ruta = window.location.pathname || '/tareas';
    const query = queryZona(filtro);
    window.history.replaceState(null, '', query ? `${ruta}?${query}` : ruta);
  } catch {
    // Entornos de prueba sin history completo: el filtro sigue en memoria.
  }
}

/** Lee el filtro inicial y limpia parámetros inválidos de la URL. */
function leerFiltroInicial(): FiltroZona | null {
  try {
    const search = window.location.search;
    const filtro = leerFiltroZona(search);
    if (!filtro && search) {
      const ruta = window.location.pathname || '/tareas';
      window.history.replaceState(null, '', ruta);
    }
    return filtro;
  } catch {
    return null;
  }
}

export default function TableroTareas() {
  const [rol, setRol] = useState<RolBackend | null>(null);
  const [cargandoPerfil, setCargandoPerfil] = useState(true);
  const [errorPerfil, setErrorPerfil] = useState('');

  const [tareas, setTareas] = useState<TareaTablero[]>([]);
  const [pagina, setPagina] = useState(0);
  const [hayMas, setHayMas] = useState(false);
  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState(false);
  const [filtro, setFiltro] = useState<FiltroZona | null>(() =>
    leerFiltroInicial()
  );
  const [modalAbierto, setModalAbierto] = useState(false);

  const centinelaRef = useRef<HTMLLIElement>(null);
  const botonBuscarRef = useRef<HTMLButtonElement>(null);
  const iniciadoRef = useRef(false);

  // Descarta respuestas de peticiones antiguas (cambio de filtro o
  // reintento mientras otra seguía en vuelo).
  const peticionRef = useRef(0);

  /**
   * Trae una página. `reemplazar` reinicia la lista (carga inicial o
   * filtro nuevo); si no, la añade al final. Un 401 va a /login.
   */
  const cargarPagina = useCallback(
    async (siguiente: number, filtroActual: FiltroZona | null, reemplazar: boolean) => {
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
          ...filtroActual,
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

  /** Verifica el rol y, solo si es afiliado, carga la primera página. */
  const cargarPerfil = useCallback(
    async (filtroActual: FiltroZona | null) => {
      setCargandoPerfil(true);
      setErrorPerfil('');
      try {
        const token = obtenerToken();
        if (!token) throw new ErrorSesionExpirada();
        const perfil = await obtenerPerfil(token);
        setRol(perfil.rol);
        if (perfil.rol === 'afiliado') {
          await cargarPagina(1, filtroActual, true);
        }
      } catch (err: unknown) {
        if (err instanceof ErrorSesionExpirada) {
          window.location.href = '/login?expirada=1';
          return;
        }
        setErrorPerfil(MENSAJE_ERROR_PERFIL);
      } finally {
        setCargandoPerfil(false);
      }
    },
    [cargarPagina]
  );

  useEffect(() => {
    if (iniciadoRef.current) return;
    iniciadoRef.current = true;
    if (!estaFirmado()) {
      setCargandoPerfil(false);
      setCargandoInicial(false);
      return;
    }
    void cargarPerfil(filtro);
  }, [cargarPerfil, filtro]);

  // Atrás/adelante del navegador: vuelve a leer la URL.
  useEffect(() => {
    const alVolver = () => {
      if (rol !== 'afiliado') return;
      const leido = leerFiltroZona(window.location.search);
      setFiltro(leido);
      void cargarPagina(1, leido, true);
    };
    window.addEventListener('popstate', alVolver);
    return () => window.removeEventListener('popstate', alVolver);
  }, [rol, cargarPagina]);

  const cargarSiguiente = useCallback(() => {
    if (cargandoInicial || cargandoMas || !hayMas || error) return;
    void cargarPagina(pagina + 1, filtro, false);
  }, [
    cargandoInicial,
    cargandoMas,
    hayMas,
    error,
    pagina,
    filtro,
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
    if (errorPerfil) {
      void cargarPerfil(filtro);
      return;
    }
    // Si falló el primer bloque se repite desde la página 1; si falló uno
    // posterior se reintenta solo ese (la lista ya cargada se conserva).
    const fallo1 = tareas.length === 0;
    void cargarPagina(fallo1 ? 1 : pagina + 1, filtro, fallo1);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setTimeout(() => botonBuscarRef.current?.focus(), 0);
  };

  const aplicarFiltro = (nuevo: FiltroZona) => {
    setFiltro(nuevo);
    sincronizarUrl(nuevo);
    setModalAbierto(false);
    void cargarPagina(1, nuevo, true);
    setTimeout(() => botonBuscarRef.current?.focus(), 0);
  };

  const limpiarFiltro = () => {
    setFiltro(null);
    sincronizarUrl(null);
    void cargarPagina(1, null, true);
  };

  const irAlDetalle = (id: string) => {
    window.location.href = `/tareas/detalle?id=${encodeURIComponent(id)}`;
  };

  const alClicTarjeta = (
    evento: React.MouseEvent<HTMLLIElement>,
    id: string
  ) => {
    const objetivo = evento.target as HTMLElement;
    if (objetivo.closest('a, button')) return;
    irAlDetalle(id);
  };

  const firmado = estaFirmado();

  if (!firmado) {
    return (
      <PantallaSinSesion
        titulo="Explora tareas"
        subtitulo="Inicia sesión para ver las solicitudes activas y ofertar."
      />
    );
  }

  if (cargandoPerfil) {
    return <PantallaCargando texto="Cargando tareas disponibles…" />;
  }

  if (errorPerfil) {
    return (
      <div className="ch-auth">
        <div className="ch-card">
          <AlertaConReintento
            mensaje={errorPerfil}
            onReintentar={reintentar}
          />
        </div>
      </div>
    );
  }

  // Guardia de rol: mismo aviso que `/perfil/disponibilidad`.
  if (rol !== 'afiliado') {
    return (
      <div className="ch-auth">
        <div className="ch-card">
          <h2 className="ch-card__title">Tareas disponibles</h2>
          <div className="ch-alert ch-alert--error" role="alert">
            {MENSAJE_SOLO_AFILIADOS} <a href="/">Volver al inicio</a>.
          </div>
        </div>
      </div>
    );
  }

  if (cargandoInicial && tareas.length === 0 && !filtro) {
    return <PantallaCargando texto="Cargando tareas disponibles…" />;
  }

  const sinResultados =
    !cargandoInicial && !error && tareas.length === 0 && pagina > 0;

  return (
    <div className="ch-auth">
      <div className="ch-card ch-card--wide ch-tablero">
        <div className="ch-tablero__head">
          <div>
            <h2 className="ch-card__title">Tareas disponibles</h2>
            <p className="ch-card__subtitle">
              {tareas.length > 0
                ? `${tareas.length}${hayMas ? '+' : ''} ${tareas.length === 1 && !hayMas ? 'solicitud activa' : 'solicitudes activas'}`
                : ''}
            </p>
          </div>
          <div className="ch-tablero__acciones">
            <button
              ref={botonBuscarRef}
              type="button"
              className="ch-btn ch-btn--primary"
              onClick={() => setModalAbierto(true)}
            >
              Buscar por zona
            </button>
            <button
              type="button"
              className="ch-btn ch-btn--ghost"
              onClick={limpiarFiltro}
              disabled={!filtro}
            >
              Ver todas
            </button>
          </div>
        </div>

        {filtro && (
          <p className="ch-filtro-activo">
            <span className="ch-filtro-activo__punto" aria-hidden="true" />
            Buscando en un radio de {filtro.radio} km
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
          <>
            <p className="ch-field__hint">
              {filtro
                ? 'No hay tareas abiertas dentro de ese radio.'
                : MENSAJE_TABLERO_VACIO}
            </p>
            {filtro && (
              <button
                type="button"
                className="ch-btn ch-btn--ghost"
                onClick={limpiarFiltro}
              >
                Ver todas
              </button>
            )}
          </>
        )}

        {tareas.length > 0 && (
          <ul className="ch-tareas ch-tareas--grid">
            {tareas.map((tarea) => (
              <li
                className="ch-tarea ch-tarea--clicable"
                key={tarea.id}
                onClick={(evento) => alClicTarjeta(evento, tarea.id)}
              >
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
                  {filtro &&
                    tarea.latitud !== null &&
                    tarea.longitud !== null && (
                      <span className="ch-tarea__distancia">
                        {formatearDistancia(
                          distanciaKm(filtro, {
                            lat: tarea.latitud,
                            lng: tarea.longitud,
                          })
                        )}
                      </span>
                    )}
                  <a
                    className="ch-btn ch-btn--ghost"
                    href={`/tareas/detalle?id=${encodeURIComponent(tarea.id)}`}
                  >
                    Ver
                  </a>
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

        {modalAbierto && (
          <ModalZona
            filtroInicial={filtro}
            onBuscar={aplicarFiltro}
            onCerrar={cerrarModal}
          />
        )}
      </div>
    </div>
  );
}
