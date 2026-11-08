/**
 * Selector de 1 a 5 estrellas (US-016). Es un grupo de opciones accesible:
 * cada estrella es un `radio` con su etiqueta ("3 estrellas"). Con `error`
 * se resalta visualmente y se asocia el mensaje al grupo.
 */
import React from 'react';
import './auth.css';

type Props = {
  /** 0 = aún sin elegir. */
  valor: number;
  onCambio: (valor: number) => void;
  error?: string;
  disabled?: boolean;
};

const OPCIONES = [1, 2, 3, 4, 5] as const;

export default function SelectorEstrellas({
  valor,
  onCambio,
  error,
  disabled = false,
}: Readonly<Props>) {
  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Calificación en estrellas"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'ch-estrellas-error' : undefined}
        className={`ch-estrellas-input${error ? ' ch-estrellas-input--error' : ''}`}
      >
        {OPCIONES.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={valor === n}
            aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`}
            className={`ch-estrella${n <= valor ? ' ch-estrella--llena' : ''}`}
            disabled={disabled}
            onClick={() => onCambio(n)}
          >
            {n <= valor ? '★' : '☆'}
          </button>
        ))}
      </div>
      {error && (
        <p id="ch-estrellas-error" className="ch-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
