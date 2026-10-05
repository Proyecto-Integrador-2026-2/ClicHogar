import React from 'react';
import ClerkRoot from './ClerkRoot';
import TareaForm from './TareaForm';

/**
 * Isla de publicación de tarea (US-006): provider Clerk + formulario.
 * Usar con `client:only="react"` para evitar el render en servidor.
 */
export default function TareaIsla({
  publishableKey,
}: {
  publishableKey: string;
}) {
  return (
    <ClerkRoot publishableKey={publishableKey}>
      <TareaForm />
    </ClerkRoot>
  );
}
