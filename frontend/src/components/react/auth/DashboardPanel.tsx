/**
 * Panel principal post-login (dashboard): saludo personalizado + tres
 * indicadores (rol, avance del perfil, tareas abiertas) con accesos a
 * cada módulo. Sin sesión invita a entrar; sin red: alerta + reintento.
 * La navegación a los módulos vive en `pages/dashboard` (Astro puro).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import {
  ErrorSesionExpirada,
  listarTareas,
  obtenerPerfil,
  type UsuarioPublico,
} from '../../../lib/usuarios-api';
import './auth.css';
import { contarAbiertas, etiquetaRol, resumenPerfil } from './dashboard.stats';

export default function DashboardPanel() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();

  const [perfil, setPerfil] = useState<UsuarioPublico | null>(null);
  const [abiertas, setAbiertas] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [globalError, setGlobalError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setGlobalError('');
    try {
      const token = await getToken();
      if (!token) {
        throw new Error(
          'No se pudo obtener la sesión. Recarga e inténtalo de nuevo.'
        );
      }
      const [perfilApi, tareas] = await Promise.all([
        obtenerPerfil(token),
        listarTareas(token),
      ]);
      setPerfil(perfilApi);
      setAbiertas(contarAbiertas(tareas));
    } catch (err: unknown) {
      if (err instanceof ErrorSesionExpirada) {
        window.location.href = '/login?expirada=1';
        return;
      }
      setGlobalError(
        err instanceof Error ? err.message : 'No se pudo cargar tu panel.'
      );
    } finally {
      setCargando(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setCargando(false);
      return;
    }
    void cargar();
  }, [isLoaded, isSignedIn, cargar]);

  if (!isLoaded || cargando) {
    return (
      <div className="ch-auth">
        <div className="ch-card">
          <p className="ch-status" role="status">
            Cargando tu panel…
          </p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="ch-auth">
        <div className="ch-card">
          <h2 className="ch-card__title">Tu panel</h2>
          <p className="ch-card__subtitle">
            Inicia sesión para ver tu resumen y gestionar tus servicios.
          </p>
          <a className="ch-btn ch-btn--primary" href="/login">
            Iniciar sesión
          </a>
        </div>
      </div>
    );
  }

  const nombre =
    user?.firstName ?? perfil?.nombre ?? user?.username ?? 'miembro';
  const resumen = perfil ? resumenPerfil(perfil) : null;

  return (
    <div className="ch-auth">
      <div className="ch-card ch-card--wide">
        <h2 className="ch-card__title">Hola, {nombre}</h2>
        <p className="ch-card__subtitle">
          {perfil
            ? `Este es tu resumen como ${etiquetaRol(perfil.rol)}`
            : 'Este es tu resumen'}
        </p>

        {globalError && (
          <div className="ch-alert ch-alert--error" role="alert">
            <p style={{ margin: '0 0 8px' }}>{globalError}</p>
            <button
              type="button"
              className="ch-btn ch-btn--primary"
              onClick={() => void cargar()}
            >
              Reintentar
            </button>
          </div>
        )}

        {resumen && (
          <dl className="ch-dash-stats">
            <div className="ch-dash-stat">
              <dt>Mi rol</dt>
              <dd>{perfil ? etiquetaRol(perfil.rol) : '—'}</dd>
            </div>
            <div className="ch-dash-stat">
              <dt>Perfil público</dt>
              <dd>
                {resumen.porcentaje}%
                <span className="ch-dash-stat__hint">
                  {resumen.pendientes.length === 0 ? (
                    'Completo'
                  ) : (
                    <a href="/perfil/configurar">
                      Falta: {resumen.pendientes.join(', ')}
                    </a>
                  )}
                </span>
              </dd>
            </div>
            <div className="ch-dash-stat">
              <dt>Tareas abiertas</dt>
              <dd>
                {abiertas}
                <span className="ch-dash-stat__hint">
                  <a href="/tareas">Explorar tablero</a>
                </span>
              </dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}
