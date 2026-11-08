/**
 * Puntaje en estrellas (US-012, Escenario 5): 5 estrellas con el promedio al
 * lado y, entre paréntesis, cuántas calificaciones lo sustentan. Sin
 * calificaciones muestra "Sin calificaciones".
 */
import React from 'react';
import './auth.css';

type Props = {
  /** Promedio de 1 a 5, o null si no hay calificaciones. */
  promedio: number | null;
  total: number;
};

const ESTRELLAS = 5;

/** `4.3` -> `4,3` (formato de Colombia). */
export function formatearPromedio(promedio: number): string {
  return promedio.toLocaleString('es-CO', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export default function Estrellas({ promedio, total }: Readonly<Props>) {
  if (promedio === null) {
    return (
      <span className="ch-estrellas ch-estrellas--vacio">
        Sin calificaciones
      </span>
    );
  }
  const llenas = Math.round(promedio);
  return (
    <span
      className="ch-estrellas"
      role="img"
      aria-label={`${formatearPromedio(promedio)} de 5 estrellas, ${total} ${total === 1 ? 'calificación' : 'calificaciones'}`}
    >
      <span aria-hidden="true">
        {'★'.repeat(llenas)}
        {'☆'.repeat(ESTRELLAS - llenas)}
      </span>{' '}
      <span aria-hidden="true">
        {formatearPromedio(promedio)} ({total})
      </span>
    </span>
  );
}
