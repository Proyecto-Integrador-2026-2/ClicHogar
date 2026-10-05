/**
 * Tablero de solicitudes abiertas (US-008): lista centralizada para
 * comparar y elegir tareas. Sin sesión muestra invitación a entrar;
 * con sesión trae el tablero (vacío con estado explícito si no hay).
 * Sin red: alerta + reintento sin perder la página.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import {
  ErrorSesionExpirada,
  listarTareas,
  type TareaTablero,
} from '../../../lib/usuarios-api';
import './auth.css';

function fechaCorta(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  return fecha.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
  });
}

export default function TableroTareas() {
  const { isLoaded, isSignedIn } = useUser();
  const { getToken } = useAuth();

  const [tareas, setTareas] = useState<TareaTablero[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [globalError, setGlobalError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setGlobalError('');
    try {
      const token = await getToken();
      if (!token) {
        throw new Error(
          'No se pudo obtener la sesión. Recarga e inténtalo de nuevo.'
        );
      }
      setTareas(await listarTareas(token));
    } catch (err: unknown) {
      if (err instanceof ErrorSesionExpirada) {
        window.location.href = '/login?expirada=1';
        return;
      }
      setGlobalError(
        err instanceof Error ? err.message : 'No se pudo cargar el tablero.'
      );
    } finally {
      setCargando(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setCargando(false);
      return;
    }
    void cargar();
  }, [isLoaded, isSignedIn, cargar]);

  if (!isLoaded || cargando) {
    return (
      <div className="ch-auth">
        <div className="ch-card">
          <p className="ch-status" role="status">
            Cargando tareas disponibles…
          </p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="ch-auth">
        <div className="ch-card">
          <h2 className="ch-card__title">Explora tareas</h2>
          <p className="ch-card__subtitle">
            Inicia sesión para ver las solicitudes activas y ofertar.
          </p>
          <a className="ch-btn ch-btn--primary" href="/login">
            Iniciar sesión
          </a>
        </div>
      </div>
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

        {globalError && (
          <div className="ch-alert ch-alert--error" role="alert">
            <p style={{ margin: '0 0 8px' }}>{globalError}</p>
            <button
              type="button"
              className="ch-btn ch-btn--primary"
              onClick={() => void cargar()}
            >
              Reintentar
            </button>
          </div>
        )}

        {tareas !== null && tareas.length === 0 && !globalError && (
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
                <span className="ch-badge">Abierta</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
