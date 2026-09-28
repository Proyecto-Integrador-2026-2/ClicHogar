import React from 'react';
import ClerkRoot from './ClerkRoot';
import RegisterForm from './RegisterForm';

/**
 * Isla de registro (US-001): provider Clerk + formulario.
 * Usar con `client:only="react"` para evitar el render en servidor.
 */
export default function RegisterIsla({
  publishableKey,
}: {
  publishableKey: string;
}) {
  return (
    <ClerkRoot publishableKey={publishableKey}>
      <RegisterForm />
    </ClerkRoot>
  );
}
