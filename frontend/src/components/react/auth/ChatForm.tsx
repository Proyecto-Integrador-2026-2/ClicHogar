import React, { useEffect, useState } from 'react';
import { obtenerToken } from '../../../lib/auth';
import { enviarMensaje, listarConversacion, type MensajeApi } from '../../../lib/usuarios-api';
import './auth.css';

export default function ChatForm() {
  const getToken = obtenerToken;
  const [destinatarioId, setDestinatarioId] = useState('');
  const [contenido, setContenido] = useState('');
  const [mensajes, setMensajes] = useState<MensajeApi[]>([]);
  const [error, setError] = useState('');

  const cargar = async () => {
    const token = getToken();
    if (!token || !destinatarioId) return;
    try {
      setMensajes(await listarConversacion({ token, usuarioId: destinatarioId }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  };

  useEffect(() => { void cargar(); }, [destinatarioId]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token || !destinatarioId || !contenido.trim()) return;
    try {
      await enviarMensaje({ token, destinatarioId, contenido: contenido.trim() });
      setContenido('');
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  };

  return (
    <div className="ch-auth">
      <div className="ch-card ch-card--wide">
        <h2 className="ch-card__title">Chat</h2>
        <input className="ch-input" placeholder="ID del destinatario" value={destinatarioId} onChange={(e) => setDestinatarioId(e.target.value)} />
        <div className="ch-chat">
          {mensajes.map((m) => (
            <p key={m.id}>{m.contenido}</p>
          ))}
        </div>
        <form onSubmit={enviar} className="ch-form">
          <input className="ch-input" value={contenido} onChange={(e) => setContenido(e.target.value)} placeholder="Mensaje" />
          <button type="submit" className="ch-btn ch-btn--primary">Enviar</button>
        </form>
        {error && <div className="ch-alert ch-alert--error">{error}</div>}
      </div>
    </div>
  );
}