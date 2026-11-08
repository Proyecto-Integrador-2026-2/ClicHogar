/**
 * Ofertas recibidas por una tarea propia (US-012).
 * - Esc 1: foto, nombre, promedio en estrellas y mensaje de cada postulante.
 * - Esc 2: la foto y el nombre llevan al perfil público del afiliado.
 * - Esc 3: estado vacío con su mensaje.
 * - Esc 4: sin permiso (no eres el creador) se muestra el aviso y nada más.
 * - Esc 5: el backend entrega la lista ordenada por reputación y recencia.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { obtenerToken } from '../../../lib/auth';
import {
  ErrorSesionExpirada,
  ErrorSinPermisoOfertas,
  listarOfertasRecibidas,
  urlPublica,
  type OfertaRecibidaApi,
} from '../../../lib/usuarios-api';
import './auth.css';
import { AlertaConReintento, PantallaCargando } from './carga-sesion';
import Estrellas from './Estrellas';

export const MENSAJE_SIN_OFERTAS =
  'Aún no has recibido ofertas. Te notificaremos cuando un afiliado se postule para esta tarea.';
export const MENSAJE_SIN_PERMISO_OFERTAS =
  'No tienes los permisos necesarios para ver las ofertas de esta tarea.';
export const MENSAJE_ERROR_OFERTAS =
  'No pudimos cargar las ofertas. Por favor, verifica tu conexión e intenta nuevamente';

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'listo'; ofertas: OfertaRecibidaApi[] }
  | { tipo: 'sin-permiso' }
  | { tipo: 'error' };

/** Enlace al perfil público del afiliado. */
export const hrefPerfil = (id: string) =>
  `/perfil/publico?id=${encodeURIComponent(id)}`;

function fechaCorta(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

function Tarjeta({ oferta }: Readonly<{ oferta: OfertaRecibidaApi }>) {
  const { afiliado } = oferta;
  const fecha = fechaCorta(oferta.creadoEn);
  return (
    <li className="ch-oferta">
      <a
        className="ch-oferta__perfil"
        href={hrefPerfil(afiliado.id)}
        aria-label={`Ver perfil de ${afiliado.nombre}`}
      >
        {afiliado.fotoUrl ? (
          <img
            className="ch-autor__foto"
            src={urlPublica(afiliado.fotoUrl)}
            alt={`Foto de ${afiliado.nombre}`}
          />
        ) : (
          <span
            className="ch-autor__foto ch-autor__foto--vacia"
            aria-hidden="true"
          >
            {afiliado.nombre.charAt(0).toUpperCase()}
          </span>
        )}
      </a>
      <div className="ch-oferta__cuerpo">
        <h4 className="ch-autor__nombre">
          <a href={hrefPerfil(afiliado.id)}>{afiliado.nombre}</a>
        </h4>
        <Estrellas
          promedio={afiliado.promedio}
          total={afiliado.totalCalificaciones}
        />
        {oferta.mensaje && (
          <p className="ch-oferta__mensaje">“{oferta.mensaje}”</p>
        )}
        {fecha && <p className="ch-tarea__meta">Postulado el {fecha}</p>}
      </div>
    </li>
  );
}

export default function OfertasRecibidas({
  tareaId,
}: Readonly<{ tareaId: string }>) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });

  const cargar = useCallback(async () => {
    setEstado({ tipo: 'cargando' });
    try {
      const token = obtenerToken();
      if (!token) throw new ErrorSesionExpirada();
      setEstado({
        tipo: 'listo',
        ofertas: await listarOfertasRecibidas(token, tareaId),
      });
    } catch (err: unknown) {
      if (err instanceof ErrorSesionExpirada) {
        window.location.href = '/login?expirada=1';
        return;
      }
      setEstado({
        tipo: err instanceof ErrorSinPermisoOfertas ? 'sin-permiso' : 'error',
      });
    }
  }, [tareaId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <section className="ch-ofertas" aria-label="Ofertas recibidas">
      <h3 className="ch-autor__nombre">Ofertas recibidas</h3>
      {estado.tipo === 'cargando' && (
        <PantallaCargando texto="Cargando ofertas…" />
      )}
      {estado.tipo === 'sin-permiso' && (
        <div className="ch-alert ch-alert--error" role="alert">
          {MENSAJE_SIN_PERMISO_OFERTAS}
        </div>
      )}
      {estado.tipo === 'error' && (
        <AlertaConReintento
          mensaje={MENSAJE_ERROR_OFERTAS}
          onReintentar={() => void cargar()}
        />
      )}
      {estado.tipo === 'listo' && estado.ofertas.length === 0 && (
        <p className="ch-field__hint">{MENSAJE_SIN_OFERTAS}</p>
      )}
      {estado.tipo === 'listo' && estado.ofertas.length > 0 && (
        <ul className="ch-ofertas__lista">
          {estado.ofertas.map((oferta) => (
            <Tarjeta key={oferta.id} oferta={oferta} />
          ))}
        </ul>
      )}
    </section>
  );
}
