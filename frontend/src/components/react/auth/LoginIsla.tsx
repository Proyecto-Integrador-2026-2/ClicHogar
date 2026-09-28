import React from 'react';
import ClerkRoot from './ClerkRoot';
import LoginForm from './LoginForm';

/**
 * Isla de inicio de sesión (US-002): provider Clerk + formulario.
 * Usar con `client:only="react"` para evitar el render en servidor.
 */
export default function LoginIsla({
  publishableKey,
}: {
  publishableKey: string;
}) {
  return (
    <ClerkRoot publishableKey={publishableKey}>
      <LoginForm />
    </ClerkRoot>
  );
}
