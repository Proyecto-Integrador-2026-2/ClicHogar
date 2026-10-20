/**
 * Piezas compartidas por las pantallas que cargan datos con la sesión de
 * Clerk (panel y tablero): el hook de carga y los estados visuales de
 * "cargando", "sin sesión" y "error con reintento".
 */
import React, { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { ErrorSesionExpirada } from '../../../lib/usuarios-api';
import './auth.css';

/**
 * Carga `cargarDatos(token)` cuando Clerk está listo y hay sesión.
 * - Sin sesión no llama al backend (la pantalla invita a entrar).
 * - `ErrorSesionExpirada` redirige a `/login?expirada=1`.
 * - Cualquier otro fallo queda en `error` y `recargar` reintenta.
 * `cargarDatos` debe ser estable (función de módulo o `useCallback`).
 */
export function useCargaConSesion<T>(
  cargarDatos: (token: string) => Promise<T>,
  mensajeError: string
) {
  const { isLoaded, isSignedIn } = useUser();
  const { getToken } = useAuth();

  const [datos, setDatos] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const recargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const token = await getToken();
      if (!token) {
        throw new Error(
          'No se pudo obtener la sesión. Recarga e inténtalo de nuevo.'
        );
      }
      setDatos(await cargarDatos(token));
    } catch (err: unknown) {
      if (err instanceof ErrorSesionExpirada) {
        window.location.href = '/login?expirada=1';
        return;
      }
      setError(err instanceof Error ? err.message : mensajeError);
    } finally {
      setCargando(false);
    }
  }, [getToken, cargarDatos, mensajeError]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setCargando(false);
      return;
    }
    void recargar();
  }, [isLoaded, isSignedIn, recargar]);

  return {
    datos,
    error,
    recargar,
    firmado: isLoaded && isSignedIn,
    cargando: !isLoaded || cargando,
  };
}

/** Tarjeta centrada con los tokens visuales del módulo de autenticación. */
function Tarjeta({ children }: { children: ReactNode }) {
  return (
    <div className="ch-auth">
      <div className="ch-card">{children}</div>
    </div>
  );
}

export function PantallaCargando({ texto }: { texto: string }) {
  return (
    <Tarjeta>
      <p className="ch-status" role="status">
        {texto}
      </p>
    </Tarjeta>
  );
}

export function PantallaSinSesion({
  titulo,
  subtitulo,
}: {
  titulo: string;
  subtitulo: string;
}) {
  return (
    <Tarjeta>
      <h2 className="ch-card__title">{titulo}</h2>
      <p className="ch-card__subtitle">{subtitulo}</p>
      <a className="ch-btn ch-btn--primary" href="/login">
        Iniciar sesión
      </a>
    </Tarjeta>
  );
}

export function AlertaConReintento({
  mensaje,
  onReintentar,
}: {
  mensaje: string;
  onReintentar: () => void;
}) {
  return (
    <div className="ch-alert ch-alert--error" role="alert">
      <p style={{ margin: '0 0 8px' }}>{mensaje}</p>
      <button
        type="button"
        className="ch-btn ch-btn--primary"
        onClick={onReintentar}
      >
        Reintentar
      </button>
    </div>
  );
}
