/**
 * "Mis solicitudes" (US-012, Escenario 1): las tareas del usuario con el
 * número de ofertas de cada una y un acceso al detalle, donde están las
 * ofertas recibidas.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { estaFirmado, obtenerToken } from '../../../lib/auth';
import {
  ErrorSesionExpirada,
  listarMisTareas,
  type TareaPropiaApi,
} from '../../../lib/usuarios-api';
import './auth.css';
import {
  AlertaConReintento,
  PantallaCargando,
  PantallaSinSesion,
} from './carga-sesion';

export const MENSAJE_SIN_SOLICITUDES = 'Aún no has publicado ninguna tarea.';
export const MENSAJE_ERROR_SOLICITUDES =
  'No pudimos cargar tus solicitudes. Por favor, verifica tu conexión e intenta nuevamente';

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'listo'; tareas: TareaPropiaApi[] }
  | { tipo: 'error' };

/** "1 oferta" / "3 ofertas" / "Sin ofertas". */
export function textoOfertas(total: number): string {
  if (total === 0) return 'Sin ofertas';
  return `${total} ${total === 1 ? 'oferta' : 'ofertas'}`;
}

export default function MisSolicitudes() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });

  const cargar = useCallback(async () => {
    setEstado({ tipo: 'cargando' });
    try {
      const token = obtenerToken();
      if (!token) throw new ErrorSesionExpirada();
      setEstado({ tipo: 'listo', tareas: await listarMisTareas(token) });
    } catch (err: unknown) {
      if (err instanceof ErrorSesionExpirada) {
        window.location.href = '/login?expirada=1';
        return;
      }
      setEstado({ tipo: 'error' });
    }
  }, []);

  useEffect(() => {
    if (estaFirmado()) void cargar();
  }, [cargar]);

  if (!estaFirmado()) {
    return (
      <PantallaSinSesion
        titulo="Mis solicitudes"
        subtitulo="Inicia sesión para ver tus solicitudes y sus ofertas."
      />
    );
  }
  if (estado.tipo === 'cargando') {
    return <PantallaCargando texto="Cargando tus solicitudes…" />;
  }

  return (
    <div className="ch-auth">
      <div className="ch-card ch-card--wide">
        <h2 className="ch-card__title">Mis solicitudes</h2>
        {estado.tipo === 'error' && (
          <AlertaConReintento
            mensaje={MENSAJE_ERROR_SOLICITUDES}
            onReintentar={() => void cargar()}
          />
        )}
        {estado.tipo === 'listo' && estado.tareas.length === 0 && (
          <>
            <p className="ch-field__hint">{MENSAJE_SIN_SOLICITUDES}</p>
            <a className="ch-btn ch-btn--primary" href="/tareas/nueva">
              Publicar una tarea
            </a>
          </>
        )}
        {estado.tipo === 'listo' && estado.tareas.length > 0 && (
          <ul className="ch-tareas">
            {estado.tareas.map((tarea) => (
              <li className="ch-tarea" key={tarea.id}>
                <div className="ch-tarea__head">
                  <h3 className="ch-tarea__titulo">{tarea.titulo}</h3>
                  <span className="ch-chip">{tarea.categoria}</span>
                </div>
                <p className="ch-tarea__meta">{tarea.ubicacion}</p>
                <div className="ch-tarea__actions">
                  <span className="ch-badge">
                    {tarea.estado === 'abierta' ? 'Abierta' : tarea.estado}
                  </span>
                  <span className="ch-tarea__meta">
                    {textoOfertas(tarea.totalOfertas)}
                  </span>
                  <a
                    className="ch-btn ch-btn--ghost"
                    href={`/tareas/detalle?id=${encodeURIComponent(tarea.id)}`}
                  >
                    Ver ofertas
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
