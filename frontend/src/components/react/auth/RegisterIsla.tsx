import React from 'react';
import { ClerkProvider } from '@clerk/clerk-react';
import RegisterForm from './RegisterForm';
import './RegisterForm.css';

/**
 * Raíz de la isla de registro (US-001).
 * Los hooks de `@clerk/clerk-react` (`useSignUp`, `useAuth`) solo funcionan
 * dentro de un `<ClerkProvider>` del MISMO árbol React, por eso el provider
 * vive aquí y no en el `.astro`: Astro hidrata cada isla como un root
 * separado y el contexto no cruza ese límite.
 * Usar con `client:only="react"` para evitar el render en servidor.
 */
export default function RegisterIsla({
  publishableKey,
}: {
  publishableKey: string;
}) {
  // Sin clave no hay Clerk que proveer: mensaje con los mismos tokens
  // visuales (el CSS se importa arriba para que exista en esta rama).
  if (!publishableKey) {
    return (
      <div className="ch-register">
        <div className="ch-card">
          <div className="ch-alert ch-alert--error" role="alert">
            Falta PUBLIC_CLERK_PUBLISHABLE_KEY. Crea frontend/.env desde
            .env.example y reinicia el servidor.
          </div>
        </div>
      </div>
    );
  }
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <RegisterForm />
    </ClerkProvider>
  );
}
