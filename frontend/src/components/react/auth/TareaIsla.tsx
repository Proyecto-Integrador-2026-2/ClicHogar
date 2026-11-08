import React from 'react';
import TareaForm from './TareaForm';

/**
 * Isla de publicación de tarea (US-006): provider Clerk + formulario.
 * Usar con `client:only="react"` para evitar el render en servidor.
 */
export default function TareaIsla() {
  return (      <TareaForm />
  );
}
