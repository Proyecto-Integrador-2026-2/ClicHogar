import React from 'react';
import ClerkRoot from './ClerkRoot';
import PerfilForm from './PerfilForm';

/**
 * Isla de perfil público (US-004): provider Clerk + formulario.
 * Usar con `client:only="react"` para evitar el render en servidor.
 */
export default function PerfilIsla({
  publishableKey,
}: {
  publishableKey: string;
}) {
  return (
    <ClerkRoot publishableKey={publishableKey}>
      <PerfilForm />
    </ClerkRoot>
  );
}
