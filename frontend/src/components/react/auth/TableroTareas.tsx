/**
 * Tablero de solicitudes abiertas (US-008): lista centralizada para
 * comparar y elegir tareas. Sin sesión muestra invitación a entrar;
 * con sesión trae el tablero (vacío con estado explícito si no hay).
 * Sin red: alerta + reintento sin perder la página.
 */
import React from 'react';
import { listarTareas } from '../../../lib/usuarios-api';
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

const cargarTablero = (token: string) => listarTareas(token);

export default function TableroTareas() {
  const {
    datos: tareas,
    error,
    recargar,
    firmado,
    cargando,
  } = useCargaConSesion(cargarTablero, 'No se pudo cargar el tablero.');

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
                <span className="ch-badge">Abierta</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
