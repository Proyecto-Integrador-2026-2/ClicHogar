import React from 'react';
import type { ReactNode } from 'react';
import { ClerkProvider } from '@clerk/clerk-react';
import './auth.css';

/**
 * Raíz compartida de las islas de autenticación (registro y login).
 * Los hooks de `@clerk/clerk-react` solo funcionan dentro de un
 * `<ClerkProvider>` del MISMO árbol React, por eso el provider vive aquí
 * y no en el `.astro`: Astro hidrata cada isla como un root separado y el
 * contexto no cruza ese límite. Usar con `client:only="react"`.
 */
export default function ClerkRoot({
  publishableKey,
  children,
}: {
  publishableKey: string;
  children: ReactNode;
}) {
  // Sin clave no hay Clerk que proveer: mensaje con los mismos tokens
  // visuales (el CSS se importa arriba para que exista en esta rama).
  if (!publishableKey) {
    return (
      <div className="ch-auth">
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
    <ClerkProvider publishableKey={publishableKey}>{children}</ClerkProvider>
  );
}
