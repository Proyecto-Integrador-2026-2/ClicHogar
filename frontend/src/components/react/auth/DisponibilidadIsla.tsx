import React from 'react';
import ClerkRoot from './ClerkRoot';
import DisponibilidadForm from './DisponibilidadForm';

/**
 * Isla de disponibilidad semanal (US-005): provider Clerk + formulario.
 * Usar con `client:only="react"` para evitar el render en servidor.
 */
export default function DisponibilidadIsla({
  publishableKey,
}: {
  publishableKey: string;
}) {
  return (
    <ClerkRoot publishableKey={publishableKey}>
      <DisponibilidadForm />
    </ClerkRoot>
  );
}
