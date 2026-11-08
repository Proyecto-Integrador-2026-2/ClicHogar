import React, { useState } from 'react';
import { obtenerToken } from '../../../lib/auth';
import { crearCalificacion } from '../../../lib/usuarios-api';
import './auth.css';

/** Lee `?usuario=` y `?tarea=` (los pone la finalización de una tarea, US-014). */
function parametroDeLaUrl(nombre: string): string {
  try {
    return new URLSearchParams(window.location.search).get(nombre) ?? '';
  } catch {
    return '';
  }
}

export default function CalificacionForm() {
  const getToken = obtenerToken;
  const [destinatarioId, setDestinatarioId] = useState(() =>
    parametroDeLaUrl('usuario')
  );
  const [tareaId] = useState(() => parametroDeLaUrl('tarea'));
  const [puntuacion, setPuntuacion] = useState(5);
  const [comentario, setComentario] = useState('');
  const [msg, setMsg] = useState('');

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    try {
      await crearCalificacion({
        token,
        destinatarioId,
        tareaId: tareaId || null,
        puntuacion,
        comentario,
      });
      setMsg('Calificación enviada.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error');
    }
  };

  return (
    <div className="ch-auth">
      <div className="ch-card ch-card--wide">
        <h2 className="ch-card__title">Calificar</h2>
        <form onSubmit={enviar} className="ch-form">
          <input
            className="ch-input"
            placeholder="ID del usuario"
            value={destinatarioId}
            onChange={(e) => setDestinatarioId(e.target.value)}
          />
          <input
            className="ch-input"
            type="number"
            min={1}
            max={5}
            value={puntuacion}
            onChange={(e) => setPuntuacion(Number(e.target.value))}
          />
          <textarea
            className="ch-input"
            placeholder="Comentario"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
          />
          <button type="submit" className="ch-btn ch-btn--primary">
            Enviar
          </button>
        </form>
        {msg && <div className="ch-alert">{msg}</div>}
      </div>
    </div>
  );
}
