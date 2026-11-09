/**
 * "Mis ofertas" (página `/dashboard/ofertas/mias`).
 * - Bloque superior "Tareas aceptadas": solo las tareas activas donde el
 *   afiliado fue elegido; si no hay ninguna, el bloque no se muestra.
 * - Bloque inferior "Mis tareas publicadas": cada tarea del usuario con
 *   todas sus ofertas recibidas, con acceso al perfil público del afiliado.
 */
import React from 'react';
import {
  listarMisOfertas,
  urlPublica,
  type OfertaAceptadaApi,
  type OfertaRecibidaApi,
  type TareaConOfertasApi,
} from '../../../lib/usuarios-api';
import './auth.css';
import {
  AlertaConReintento,
  PantallaCargando,
  PantallaSinSesion,
  useCargaConSesion,
} from './carga-sesion';
import Estrellas from './Estrellas';
import { hrefPerfil, MENSAJE_SIN_OFERTAS } from './OfertasRecibidas';

export const MENSAJE_ERROR_MIS_OFERTAS =
  'No pudimos cargar tus ofertas. Por favor, verifica tu conexión e intenta nuevamente';
export const MENSAJE_SIN_TAREAS_PROPIAS =
  'Aún no has publicado ninguna tarea.';

/** Etiqueta de una oferta que ya se resolvió. */
const ETIQUETA_ESTADO: Record<string, string> = {
  aceptada: 'Seleccionado',
  rechazada: 'No seleccionado',
};

function fechaCorta(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

const hrefDetalle = (id: string) =>
  `/tareas/detalle?id=${encodeURIComponent(id)}`;

/** Tarjeta de una tarea aceptada, con la oferta que le fue aceptada. */
function TarjetaAceptada({ item }: Readonly<{ item: OfertaAceptadaApi }>) {
  const { tarea, oferta } = item;
  return (
    <li className="ch-tarea">
      <div className="ch-tarea__head">
        <h3 className="ch-tarea__titulo">{tarea.titulo}</h3>
        <span className="ch-chip">{tarea.categoria}</span>
      </div>
      <p className="ch-tarea__meta">{tarea.ubicacion}</p>
      <p className="ch-tarea__meta">Cliente: {tarea.autorNombre}</p>
      {oferta.mensaje && (
        <p className="ch-oferta__mensaje">“{oferta.mensaje}”</p>
      )}
      <div className="ch-tarea__actions">
        <span className="ch-badge">Asignada</span>
        <a className="ch-btn ch-btn--ghost" href={hrefDetalle(tarea.id)}>
          Ver
        </a>
      </div>
    </li>
  );
}

/** Oferta recibida en una tarea propia, con el perfil del afiliado. */
function TarjetaOferta({ oferta }: Readonly<{ oferta: OfertaRecibidaApi }>) {
  const { afiliado } = oferta;
  const fecha = fechaCorta(oferta.creadoEn);
  const etiqueta = ETIQUETA_ESTADO[oferta.estado];
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
        {etiqueta && <span className="ch-badge">{etiqueta}</span>}
      </div>
    </li>
  );
}

/** Tarea publicada con su lista completa de ofertas recibidas. */
function TareaPublicada({ item }: Readonly<{ item: TareaConOfertasApi }>) {
  const { tarea, ofertas } = item;
  return (
    <article className="ch-mis-ofertas__tarea">
      <div className="ch-mis-ofertas__tarea-head">
        <div>
          <h3 className="ch-tarea__titulo">{tarea.titulo}</h3>
          <p className="ch-tarea__meta">{tarea.ubicacion}</p>
        </div>
        <div className="ch-mis-ofertas__tarea-acciones">
          <span className="ch-badge">
            {tarea.estado === 'abierta' ? 'Abierta' : tarea.estado}
          </span>
          <a className="ch-btn ch-btn--ghost" href={hrefDetalle(tarea.id)}>
            Ver tarea
          </a>
        </div>
      </div>
      {ofertas.length === 0 ? (
        <p className="ch-field__hint">{MENSAJE_SIN_OFERTAS}</p>
      ) : (
        <ul className="ch-ofertas__lista">
          {ofertas.map((oferta) => (
            <TarjetaOferta key={oferta.id} oferta={oferta} />
          ))}
        </ul>
      )}
    </article>
  );
}

export default function MisOfertas() {
  const { datos, error, recargar, firmado, cargando } = useCargaConSesion(
    listarMisOfertas,
    MENSAJE_ERROR_MIS_OFERTAS
  );

  if (!firmado) {
    return (
      <PantallaSinSesion
        titulo="Mis ofertas"
        subtitulo="Inicia sesión para ver tus ofertas."
      />
    );
  }
  if (cargando) {
    return <PantallaCargando texto="Cargando tus ofertas…" />;
  }

  return (
    <div className="ch-auth">
      <div className="ch-card ch-card--wide">
        <h2 className="ch-card__title">Mis ofertas</h2>
        {error && (
          <AlertaConReintento
            mensaje={error || MENSAJE_ERROR_MIS_OFERTAS}
            onReintentar={() => void recargar()}
          />
        )}
        {datos && (
          <>
            {datos.aceptadas.length > 0 && (
              <section
                className="ch-mis-ofertas__bloque"
                aria-label="Tareas aceptadas"
              >
                <h3 className="ch-mis-ofertas__subtitulo">
                  Tareas aceptadas
                </h3>
                <ul className="ch-tareas ch-tareas--grid">
                  {datos.aceptadas.map((item) => (
                    <TarjetaAceptada key={item.tarea.id} item={item} />
                  ))}
                </ul>
              </section>
            )}

            <section
              className="ch-mis-ofertas__bloque"
              aria-label="Mis tareas publicadas"
            >
              <h3 className="ch-mis-ofertas__subtitulo">
                Mis tareas publicadas
              </h3>
              {datos.creadas.length === 0 ? (
                <p className="ch-field__hint">
                  {MENSAJE_SIN_TAREAS_PROPIAS}{' '}
                  <a href="/tareas/nueva">Publicar una tarea</a>
                </p>
              ) : (
                <div className="ch-mis-ofertas__tareas">
                  {datos.creadas.map((item) => (
                    <TareaPublicada key={item.tarea.id} item={item} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
