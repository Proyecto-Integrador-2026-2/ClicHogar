/**
 * Formulario para postularse a una tarea (US-011).
 * - Esc 1-2: mensaje opcional y confirmación; al terminar avisa al padre.
 * - Esc 3: un 409 (ya postulado) se comunica al padre para bloquear el envío.
 * - Esc 5: un 404/410 (la tarea ya no acepta ofertas) se comunica al padre,
 *   que avisa y vuelve al tablero.
 * - Esc 6: sin red o timeout, se detiene la carga, se evita el doble envío y
 *   se muestra un aviso temporal.
 */
import React, { useEffect, useRef, useState } from 'react';
import { obtenerToken } from '../../../lib/auth';
import {
  ErrorSesionExpirada,
  ErrorTareaNoAceptaOfertas,
  ErrorYaPostulado,
  enviarOferta,
} from '../../../lib/usuarios-api';
import './auth.css';

export const LIMITE_MENSAJE_OFERTA = 500;
export const MENSAJE_ERROR_OFERTA =
  'Error de conexión. No pudimos enviar tu oferta, por favor verifica tu red e intenta nuevamente.';
/** Cuánto dura visible el aviso de error de conexión. */
export const ERROR_TEMPORAL_MS = 6000;

type Props = {
  tareaId: string;
  /** La oferta quedó registrada. */
  onEnviada: () => void;
  /** El afiliado ya tenía una oferta en esta tarea. */
  onYaPostulado: () => void;
  /** La tarea dejó de aceptar ofertas mientras se confirmaba. */
  onNoAcepta: () => void;
  /** Duración del aviso de error de conexión (solo se cambia en pruebas). */
  duracionErrorMs?: number;
};

export default function OfertaForm({
  tareaId,
  onEnviada,
  onYaPostulado,
  onNoAcepta,
  duracionErrorMs = ERROR_TEMPORAL_MS,
}: Readonly<Props>) {
  const [abierto, setAbierto] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorConexion, setErrorConexion] = useState(false);
  // Guarda síncrona: un segundo clic llega antes de que React pinte `enviando`.
  const enEnvio = useRef(false);

  // El aviso de error es temporal.
  useEffect(() => {
    if (!errorConexion) return;
    const espera = setTimeout(() => setErrorConexion(false), duracionErrorMs);
    return () => clearTimeout(espera);
  }, [errorConexion, duracionErrorMs]);

  const confirmar = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (enEnvio.current) return;
    enEnvio.current = true;
    setEnviando(true);
    setErrorConexion(false);
    try {
      const token = obtenerToken();
      if (!token) throw new ErrorSesionExpirada();
      await enviarOferta(token, tareaId, mensaje);
      onEnviada();
    } catch (err: unknown) {
      if (err instanceof ErrorSesionExpirada) {
        window.location.href = '/login?expirada=1';
      } else if (err instanceof ErrorYaPostulado) {
        onYaPostulado();
      } else if (err instanceof ErrorTareaNoAceptaOfertas) {
        onNoAcepta();
      } else {
        setErrorConexion(true);
      }
    } finally {
      enEnvio.current = false;
      setEnviando(false);
    }
  };

  if (!abierto) {
    return (
      <button
        type="button"
        className="ch-btn ch-btn--primary"
        onClick={() => setAbierto(true)}
      >
        Enviar oferta
      </button>
    );
  }

  return (
    <form className="ch-form" onSubmit={confirmar} aria-busy={enviando}>
      <label className="ch-field">
        <span className="ch-field__label">
          Mensaje para el creador (opcional)
        </span>
        <textarea
          className="ch-input"
          rows={4}
          maxLength={LIMITE_MENSAJE_OFERTA}
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          placeholder="Ej. Tengo experiencia previa en este tipo de trabajos."
          disabled={enviando}
        />
        <span className="ch-field__hint">
          {mensaje.length}/{LIMITE_MENSAJE_OFERTA}
        </span>
      </label>
      {errorConexion && (
        <div className="ch-alert ch-alert--error" role="alert">
          {MENSAJE_ERROR_OFERTA}
        </div>
      )}
      <div className="ch-tarea__actions">
        <button
          type="submit"
          className="ch-btn ch-btn--primary"
          disabled={enviando}
          aria-busy={enviando}
        >
          {enviando ? 'Enviando…' : 'Confirmar postulación'}
        </button>
        <button
          type="button"
          className="ch-btn ch-btn--ghost"
          onClick={() => setAbierto(false)}
          disabled={enviando}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
