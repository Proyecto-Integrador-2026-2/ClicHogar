/**
 * Detalle de una tarea (US-009).
 * - Esc 1: título, descripción completa, categoría, ubicación aproximada y
 *   datos del autor.
 * - Esc 2: acción de ofertar si la tarea está abierta y el visitante puede
 *   (el envío vive en `OfertaForm`, US-011).
 * - Esc 3: si la tarea ya no está disponible no se muestra el detalle: se
 *   avisa y se vuelve solo al tablero.
 * - Esc 4: en una tarea propia se ve todo, pero no se ofrece ofertar; en
 *   su lugar aparecen las ofertas recibidas (US-012) y, si está abierta, la
 *   selección del prestador (US-013). Asignada: contacto mutuo (US-013),
 *   cierre con confirmación de pago para el creador y aviso de espera para
 *   el afiliado (US-014).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { estaFirmado, obtenerToken } from '../../../lib/auth';
import {
  ErrorSesionExpirada,
  ErrorTareaNoDisponible,
  obtenerTarea,
  urlPublica,
  type DetalleTareaApi,
} from '../../../lib/usuarios-api';
import './auth.css';
import {
  AlertaConReintento,
  PantallaCargando,
  PantallaSinSesion,
} from './carga-sesion';
import MapaUbicacion from './MapaUbicacion';
import OfertaForm from './OfertaForm';
import FinalizarTarea from './FinalizarTarea';
import OfertasRecibidas, { type ResultadoSeleccion } from './OfertasRecibidas';

export const MENSAJE_NO_DISPONIBLE =
  'Lo sentimos, esta tarea ya no se encuentra disponible';
export const MENSAJE_ERROR_DETALLE =
  'No pudimos cargar la tarea. Por favor, verifica tu conexión e intenta nuevamente';
export const MENSAJE_OFERTA_ENVIADA =
  'Tu oferta ha sido enviada exitosamente al creador de la tarea';
export const MENSAJE_YA_POSTULADO = 'Ya te has postulado a esta tarea';
export const MENSAJE_AFILIADO_SELECCIONADO =
  '¡Afiliado seleccionado! Ahora pueden coordinar los detalles del servicio.';
export const MENSAJE_YA_ASIGNADA =
  'Esta tarea ya cuenta con un afiliado asignado';
export const MENSAJE_ESPERANDO_CIERRE =
  'Esperando que el cliente confirme el pago y finalice la tarea';
export const MENSAJE_NO_ACEPTA_OFERTAS =
  'Lo sentimos, esta tarea ya no acepta nuevas ofertas en este momento';

/** Espera antes de volver al tablero tras avisar que la tarea no está disponible. */
export const REDIRECCION_MS = 3000;

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'listo'; tarea: DetalleTareaApi }
  | { tipo: 'no-disponible'; mensaje: string }
  | { tipo: 'error' };

/** Id de la tarea en `?id=` (cadena vacía si falta o no se puede leer). */
function idDeLaUrl(): string {
  try {
    return new URLSearchParams(window.location.search).get('id') ?? '';
  } catch {
    return '';
  }
}

function fechaLarga(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  return fecha.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

type PropsOferta = {
  tarea: DetalleTareaApi;
  onNoAcepta: () => void;
};

/** Zona de la oferta: formulario, bloqueo si ya se postuló o la explicación. */
function ZonaOferta({ tarea, onNoAcepta }: Readonly<PropsOferta>) {
  const [postulado, setPostulado] = useState(tarea.yaPostulado);
  const [exito, setExito] = useState(false);

  if (tarea.esPropia) {
    return (
      <p className="ch-field__hint">
        Esta es tu solicitud: no puedes enviar una oferta a tu propia tarea.
      </p>
    );
  }
  if (postulado) {
    return (
      <div className="ch-tarea__actions">
        <button type="button" className="ch-btn ch-btn--primary" disabled>
          Enviar oferta
        </button>
        {exito && (
          <p className="ch-alert" role="status">
            {MENSAJE_OFERTA_ENVIADA}
          </p>
        )}
        <p className="ch-field__hint">{MENSAJE_YA_POSTULADO}</p>
      </div>
    );
  }
  if (!tarea.puedeOfertar) {
    return (
      <p className="ch-field__hint">
        Solo los afiliados pueden enviar ofertas a una tarea abierta.
      </p>
    );
  }
  return (
    <OfertaForm
      tareaId={tarea.id}
      onEnviada={() => {
        setExito(true);
        setPostulado(true);
      }}
      onYaPostulado={() => setPostulado(true)}
      onNoAcepta={onNoAcepta}
    />
  );
}

/** Contacto, cierre y espera de una tarea asignada (US-013 y US-014). */
function ZonaServicio({ tarea }: Readonly<{ tarea: DetalleTareaApi }>) {
  if (tarea.estado !== 'asignada') return null;
  return (
    <section className="ch-servicio" aria-label="Servicio en curso">
      <h3 className="ch-autor__nombre">Servicio en curso</h3>
      {tarea.contacto && (
        <p className="ch-tarea__meta">
          Contacto: <strong>{tarea.contacto.nombre}</strong> ·{' '}
          <a href={`mailto:${tarea.contacto.email}`}>{tarea.contacto.email}</a>
        </p>
      )}
      <p className="ch-field__hint">
        Coordinen la fecha, la hora y los detalles del servicio.
      </p>
      {tarea.puedeFinalizar && tarea.afiliadoAsignado && (
        <FinalizarTarea
          tareaId={tarea.id}
          nombreAfiliado={tarea.afiliadoAsignado.nombre}
        />
      )}
      {tarea.esAsignado && (
        <p className="ch-alert" role="status">
          {MENSAJE_ESPERANDO_CIERRE}
        </p>
      )}
    </section>
  );
}

function Autor({ autor }: Readonly<{ autor: DetalleTareaApi['autor'] }>) {
  return (
    <section className="ch-autor" aria-label="Quién publica">
      {autor.fotoUrl && (
        <img
          className="ch-autor__foto"
          src={urlPublica(autor.fotoUrl)}
          alt={`Foto de ${autor.nombre}`}
        />
      )}
      <div>
        <h3 className="ch-autor__nombre">{autor.nombre}</h3>
        {autor.descripcion && (
          <p className="ch-tarea__meta">{autor.descripcion}</p>
        )}
        {autor.ubicacion && <p className="ch-tarea__meta">{autor.ubicacion}</p>}
      </div>
    </section>
  );
}

export default function DetalleTarea() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  // Resultado de elegir al afiliado: sobrevive a la recarga del detalle.
  const [aviso, setAviso] = useState<ResultadoSeleccion | null>(null);

  const cargar = useCallback(async () => {
    const id = idDeLaUrl();
    if (!id) {
      setEstado({ tipo: 'no-disponible', mensaje: MENSAJE_NO_DISPONIBLE });
      return;
    }
    setEstado({ tipo: 'cargando' });
    try {
      const token = obtenerToken();
      if (!token) throw new ErrorSesionExpirada();
      setEstado({ tipo: 'listo', tarea: await obtenerTarea(token, id) });
    } catch (err: unknown) {
      if (err instanceof ErrorSesionExpirada) {
        window.location.href = '/login?expirada=1';
        return;
      }
      setEstado(
        err instanceof ErrorTareaNoDisponible
          ? { tipo: 'no-disponible', mensaje: MENSAJE_NO_DISPONIBLE }
          : { tipo: 'error' }
      );
    }
  }, []);

  useEffect(() => {
    if (estaFirmado()) void cargar();
  }, [cargar]);

  // Esc 3: tras avisar, vuelve solo al tablero (que se recarga actualizado).
  useEffect(() => {
    if (estado.tipo !== 'no-disponible') return;
    const espera = setTimeout(() => {
      window.location.href = '/tareas';
    }, REDIRECCION_MS);
    return () => clearTimeout(espera);
  }, [estado.tipo]);

  if (!estaFirmado()) {
    return (
      <PantallaSinSesion
        titulo="Detalle de la tarea"
        subtitulo="Inicia sesión para ver los detalles de la tarea."
      />
    );
  }

  if (estado.tipo === 'cargando') {
    return <PantallaCargando texto="Cargando la tarea…" />;
  }

  if (estado.tipo === 'no-disponible') {
    return (
      <div className="ch-auth">
        <div className="ch-card">
          <div className="ch-alert ch-alert--error" role="alert">
            <p style={{ margin: '0 0 8px' }}>{estado.mensaje}</p>
            <p className="ch-field__hint">Te llevamos de vuelta al tablero…</p>
          </div>
          <a className="ch-btn ch-btn--primary" href="/tareas">
            Volver al tablero
          </a>
        </div>
      </div>
    );
  }

  if (estado.tipo === 'error') {
    return (
      <div className="ch-auth">
        <div className="ch-card">
          <AlertaConReintento
            mensaje={MENSAJE_ERROR_DETALLE}
            onReintentar={() => void cargar()}
          />
          <a className="ch-btn ch-btn--ghost" href="/tareas">
            Volver al tablero
          </a>
        </div>
      </div>
    );
  }

  const { tarea } = estado;
  const fecha = fechaLarga(tarea.creadoEn);
  const conMapa = tarea.latitud !== null && tarea.longitud !== null;

  return (
    <div className="ch-auth">
      <div className="ch-detalle">
        <a
          className="ch-btn ch-btn--ghost ch-detalle__volver"
          href="/tareas"
        >
          ← Volver al tablero
        </a>

        <div className="ch-detalle__hero">
          <div>
            <div className="ch-detalle__chips">
              <span className="ch-chip">{tarea.categoria}</span>
              <span className="ch-badge">
                {tarea.estado === 'abierta' ? 'Abierta' : tarea.estado}
              </span>
            </div>
            <h2 className="ch-card__title ch-detalle__titulo">
              {tarea.titulo}
            </h2>
            <p className="ch-tarea__meta">
              {tarea.ubicacion}
              {fecha ? ` · Publicada el ${fecha}` : ''}
            </p>
          </div>
        </div>

        {aviso && (
          <p
            className={
              aviso === 'asignada' ? 'ch-alert' : 'ch-alert ch-alert--error'
            }
            role={aviso === 'asignada' ? 'status' : 'alert'}
          >
            {aviso === 'asignada'
              ? MENSAJE_AFILIADO_SELECCIONADO
              : MENSAJE_YA_ASIGNADA}
          </p>
        )}

        <div
          className={`ch-detalle__grid${conMapa ? '' : ' ch-detalle__grid--sin-mapa'}`}
        >
          <div className="ch-detalle__principal">
            <section className="ch-card ch-detalle__panel">
              <h3 className="ch-autor__nombre">Descripción</h3>
              <p className="ch-detalle__descripcion">{tarea.descripcion}</p>
            </section>

            {conMapa && (
              <section
                className="ch-card ch-detalle__panel ch-detalle__mapa"
                aria-label="Ubicación"
              >
                <h3 className="ch-autor__nombre">Ubicación</h3>
                {!tarea.esPropia && (
                  <p className="ch-detalle__zona">
                    La ubicación es aproximada: se muestra un radio de 200 m
                    alrededor del punto.
                  </p>
                )}
                <MapaUbicacion
                  latitud={tarea.latitud as number}
                  longitud={tarea.longitud as number}
                  aproximada={!tarea.esPropia}
                />
              </section>
            )}
          </div>

          <aside className="ch-detalle__lateral">
            <section className="ch-card ch-detalle__panel">
              <Autor autor={tarea.autor} />
              <ZonaServicio tarea={tarea} />
              <ZonaOferta
                tarea={tarea}
                onNoAcepta={() =>
                  setEstado({
                    tipo: 'no-disponible',
                    mensaje: MENSAJE_NO_ACEPTA_OFERTAS,
                  })
                }
              />
            </section>
          </aside>
        </div>

        {tarea.esPropia && (
          <OfertasRecibidas
            tareaId={tarea.id}
            tareaAbierta={tarea.estado === 'abierta'}
            onResultado={(resultado) => {
              setAviso(resultado);
              void cargar();
            }}
          />
        )}
      </div>
    </div>
  );
}
