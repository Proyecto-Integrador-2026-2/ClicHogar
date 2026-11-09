/**
 * Panel principal post-login (dashboard): saludo personalizado + tres
 * indicadores (rol, avance del perfil, tareas abiertas) con accesos a
 * cada módulo. Sin sesión invita a entrar; sin red: alerta + reintento.
 * La navegación a los módulos vive en `pages/dashboard` (Astro puro).
 */
import React, { useEffect } from 'react';
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

/**
 * `abiertas`: solo se cuenta para afiliados (`null` en clientes).
 * `hayMas`: hay más tareas abiertas de las que cuenta el primer bloque.
 */
type DatosPanel = {
  perfil: UsuarioPublico;
  abiertas: number | null;
  hayMas: boolean;
};

/** Tamaño del bloque con el que se cuentan las abiertas (máximo del API). */
const LIMITE_CONTEO = 50;

async function cargarPanel(token: string): Promise<DatosPanel> {
  const perfil = await obtenerPerfil(token);
  // El tablero es exclusivo de afiliados: a los clientes no se les pide.
  if (perfil.rol !== 'afiliado') {
    return { perfil, abiertas: null, hayMas: false };
  }
  const pagina = await listarTareas(token, { limite: LIMITE_CONTEO });
  return {
    perfil,
    abiertas: contarAbiertas(pagina.tareas),
    hayMas: pagina.hayMas,
  };
}

/** Tres indicadores del panel: rol, avance del perfil y tareas abiertas. */
function Indicadores({
  perfil,
  abiertas,
  hayMas,
}: {
  perfil: UsuarioPublico;
  abiertas: number | null;
  hayMas: boolean;
}) {
  const resumen = resumenPerfil(perfil);
  return (
    <dl className="ch-dash-stats">
      <div className="ch-dash-stat">
        <dt>Mi rol</dt>
        <dd>{etiquetaRol(perfil.rol)}</dd>
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
      {abiertas !== null && (
        <div className="ch-dash-stat">
          <dt>Tareas abiertas</dt>
          <dd>
            {abiertas}
            {hayMas ? '+' : ''}
            <span className="ch-dash-stat__hint">
              <a href="/tareas">Explorar tablero</a>
            </span>
          </dd>
        </div>
      )}
    </dl>
  );
}

export default function DashboardPanel() {
  const { datos, error, recargar, firmado, cargando } = useCargaConSesion(
    cargarPanel,
    'No se pudo cargar tu panel.'
  );
  const perfil = datos?.perfil ?? null;

  // Publica el rol para que el CSS del dashboard muestre u oculte módulos.
  useEffect(() => {
    if (!perfil) return;
    document.documentElement.dataset.rol = perfil.rol;
  }, [perfil]);

  if (cargando) return <PantallaCargando texto="Cargando tu panel…" />;

  if (!firmado) {
    return (
      <PantallaSinSesion
        titulo="Tu panel"
        subtitulo="Inicia sesión para ver tu resumen y gestionar tus servicios."
      />
    );
  }

  const abiertas = datos?.abiertas ?? null;
  const hayMas = datos?.hayMas ?? false;
  const nombre = perfil?.nombre ?? 'miembro';

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

        {perfil && (
          <Indicadores perfil={perfil} abiertas={abiertas} hayMas={hayMas} />
        )}
      </div>
    </div>
  );
}
