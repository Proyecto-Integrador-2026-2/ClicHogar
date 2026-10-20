/**
 * Panel principal post-login (dashboard): saludo personalizado + tres
 * indicadores (rol, avance del perfil, tareas abiertas) con accesos a
 * cada módulo. Sin sesión invita a entrar; sin red: alerta + reintento.
 * La navegación a los módulos vive en `pages/dashboard` (Astro puro).
 */
import React from 'react';
import { useUser } from '@clerk/clerk-react';
import {
  listarTareas,
  obtenerPerfil,
  type UsuarioPublico,
} from '../../../lib/usuarios-api';
import './auth.css';
import {
  AlertaConReintento,
  PantallaCargando,
  PantallaSinSesion,
  useCargaConSesion,
} from './carga-sesion';
import { contarAbiertas, etiquetaRol, resumenPerfil } from './dashboard.stats';

type DatosPanel = { perfil: UsuarioPublico; abiertas: number };

async function cargarPanel(token: string): Promise<DatosPanel> {
  const [perfil, tareas] = await Promise.all([
    obtenerPerfil(token),
    listarTareas(token),
  ]);
  return { perfil, abiertas: contarAbiertas(tareas) };
}

export default function DashboardPanel() {
  const { user } = useUser();
  const { datos, error, recargar, firmado, cargando } = useCargaConSesion(
    cargarPanel,
    'No se pudo cargar tu panel.'
  );

  if (cargando) return <PantallaCargando texto="Cargando tu panel…" />;

  if (!firmado) {
    return (
      <PantallaSinSesion
        titulo="Tu panel"
        subtitulo="Inicia sesión para ver tu resumen y gestionar tus servicios."
      />
    );
  }

  const perfil = datos?.perfil ?? null;
  const abiertas = datos?.abiertas ?? 0;
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

        {error && (
          <AlertaConReintento
            mensaje={error}
            onReintentar={() => void recargar()}
          />
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
