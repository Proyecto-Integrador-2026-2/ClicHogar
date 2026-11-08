/**
 * Ventana de confirmación reutilizable (US-013 y US-014): un diálogo con
 * título, contenido, un error opcional y los botones Confirmar / Cancelar.
 * Mientras se envía bloquea ambos botones, y Escape equivale a Cancelar.
 */
import React, { useEffect } from 'react';
import './auth.css';

type Props = {
  titulo: string;
  textoConfirmar: string;
  /** Texto del botón mientras se envía (p. ej. "Enviando…"). */
  textoEnviando?: string;
  enviando: boolean;
  /** Error a mostrar dentro del diálogo (null si no hay). */
  error?: string | null;
  onConfirmar: () => void;
  onCancelar: () => void;
  children: React.ReactNode;
};

export default function ModalConfirmacion({
  titulo,
  textoConfirmar,
  textoEnviando = 'Enviando…',
  enviando,
  error = null,
  onConfirmar,
  onCancelar,
  children,
}: Readonly<Props>) {
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !enviando) onCancelar();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [enviando, onCancelar]);

  return (
    <div
      className="ch-modal"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <div className="ch-modal__card">
        <h3 className="ch-card__title">{titulo}</h3>
        {children}
        {error && (
          <div className="ch-alert ch-alert--error" role="alert">
            {error}
          </div>
        )}
        <div className="ch-tarea__actions">
          <button
            type="button"
            className="ch-btn ch-btn--primary"
            onClick={onConfirmar}
            disabled={enviando}
            aria-busy={enviando}
          >
            {enviando ? textoEnviando : textoConfirmar}
          </button>
          <button
            type="button"
            className="ch-btn ch-btn--ghost"
            onClick={onCancelar}
            disabled={enviando}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
