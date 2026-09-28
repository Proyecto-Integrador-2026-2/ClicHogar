import React, { useState } from 'react';
import { useClerk } from '@clerk/clerk-react';
import './auth.css';

/**
 * Botón de cierre de sesión (US-003: #127 visual, #128 limpieza).
 * Destruye la sesión en Clerk (vale para todas las pestañas: sin sesión
 * no se emiten tokens nuevos), limpia el almacenamiento local de la app
 * y redirige a la página pública `/`. La preferencia de tema (`ch-theme`)
 * se conserva a propósito: no es dato de sesión.
 */
export default function LogoutButton() {
  const { signOut } = useClerk();
  const [saliendo, setSaliendo] = useState(false);

  const salir = async () => {
    if (saliendo) return;
    setSaliendo(true);
    try {
      await signOut();
      sessionStorage.clear();
      window.location.href = '/';
    } finally {
      setSaliendo(false);
    }
  };

  return (
    <button
      type="button"
      className="ch-btn ch-btn--primary ch-btn--sm"
      onClick={salir}
      disabled={saliendo}
      aria-busy={saliendo}
    >
      {saliendo ? 'Cerrando...' : 'Cerrar sesión'}
    </button>
  );
}
