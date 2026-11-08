/**
 * Ofertas recibidas por una tarea propia (US-012) y selección del prestador
 * (US-013).
 * - US-012 Esc 1: foto, nombre, promedio en estrellas y mensaje de cada postulante.
 * - US-012 Esc 2: la foto y el nombre llevan al perfil público del afiliado.
 * - US-012 Esc 3: estado vacío con su mensaje.
 * - US-012 Esc 4: sin permiso (no eres el creador) se muestra el aviso y nada más.
 * - US-012 Esc 5: el backend entrega la lista ordenada por reputación y recencia.
 * - US-013 Esc 1: "Seleccionar afiliado" + confirmación definitiva.
 * - US-013 Esc 5: confirmaciones repetidas o una tarea ya asignada se resuelven
 *   registrando la asignación una sola vez y avisando.
 * - US-013 Esc 6: cancelar la confirmación no cambia nada.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { obtenerToken } from '../../../lib/auth';
import {
  ErrorSesionExpirada,
  ErrorSinConexion,
  ErrorSinPermisoOfertas,
  ErrorTareaYaAsignada,
  asignarTarea,
  listarOfertasRecibidas,
  urlPublica,
  type OfertaRecibidaApi,
} from '../../../lib/usuarios-api';
import './auth.css';
import { AlertaConReintento, PantallaCargando } from './carga-sesion';
import Estrellas from './Estrellas';
import ModalConfirmacion from './ModalConfirmacion';

export const MENSAJE_SIN_OFERTAS =
  'Aún no has recibido ofertas. Te notificaremos cuando un afiliado se postule para esta tarea.';
export const MENSAJE_SIN_PERMISO_OFERTAS =
  'No tienes los permisos necesarios para ver las ofertas de esta tarea.';
export const MENSAJE_ERROR_OFERTAS =
  'No pudimos cargar las ofertas. Por favor, verifica tu conexión e intenta nuevamente';
export const MENSAJE_ERROR_ASIGNAR =
  'No pudimos asignar la tarea. Verifica tu conexión e intenta de nuevo.';

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'listo'; ofertas: OfertaRecibidaApi[] }
  | { tipo: 'sin-permiso' }
  | { tipo: 'error' };

/** Qué pasó al intentar elegir (lo usa el padre para avisar y recargar). */
export type ResultadoSeleccion = 'asignada' | 'ya-asignada';

type Props = {
  tareaId: string;
  /** Solo una tarea abierta permite elegir (US-013). */
  tareaAbierta?: boolean;
  onResultado?: (resultado: ResultadoSeleccion) => void;
};

/** Enlace al perfil público del afiliado. */
export const hrefPerfil = (id: string) =>
  `/perfil/publico?id=${encodeURIComponent(id)}`;

function fechaCorta(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

/** Etiqueta de una oferta que ya se resolvió. */
const ETIQUETA_ESTADO: Record<string, string> = {
  aceptada: 'Seleccionado',
  rechazada: 'No seleccionado',
};

type PropsTarjeta = {
  oferta: OfertaRecibidaApi;
  seleccionable: boolean;
  onSeleccionar: (oferta: OfertaRecibidaApi) => void;
};

function Tarjeta({
  oferta,
  seleccionable,
  onSeleccionar,
}: Readonly<PropsTarjeta>) {
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
        {seleccionable && oferta.estado === 'pendiente' && (
          <button
            type="button"
            className="ch-btn ch-btn--primary"
            onClick={() => onSeleccionar(oferta)}
          >
            Seleccionar afiliado
          </button>
        )}
      </div>
    </li>
  );
}

export default function OfertasRecibidas({
  tareaId,
  tareaAbierta = false,
  onResultado,
}: Readonly<Props>) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  const [elegida, setElegida] = useState<OfertaRecibidaApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errorElegir, setErrorElegir] = useState<string | null>(null);
  // Guarda síncrona contra confirmaciones repetidas (Esc 5).
  const enCurso = useRef(false);

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

  const cancelar = () => {
    setElegida(null);
    setErrorElegir(null);
  };

  const confirmar = async () => {
    if (!elegida || enCurso.current) return;
    enCurso.current = true;
    setEnviando(true);
    setErrorElegir(null);
    try {
      const token = obtenerToken();
      if (!token) throw new ErrorSesionExpirada();
      await asignarTarea(token, tareaId, elegida.id);
      setElegida(null);
      onResultado?.('asignada');
    } catch (err: unknown) {
      if (err instanceof ErrorSesionExpirada) {
        window.location.href = '/login?expirada=1';
      } else if (err instanceof ErrorTareaYaAsignada) {
        // Otra sesión (o un clic anterior) ya la asignó: no hay nada que repetir.
        setElegida(null);
        onResultado?.('ya-asignada');
      } else {
        setErrorElegir(
          err instanceof ErrorSinConexion || !(err instanceof Error)
            ? MENSAJE_ERROR_ASIGNAR
            : err.message
        );
      }
    } finally {
      enCurso.current = false;
      setEnviando(false);
    }
  };

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
            <Tarjeta
              key={oferta.id}
              oferta={oferta}
              seleccionable={tareaAbierta}
              onSeleccionar={setElegida}
            />
          ))}
        </ul>
      )}
      {elegida && (
        <ModalConfirmacion
          titulo="Confirmar selección"
          textoConfirmar="Confirmar selección"
          enviando={enviando}
          error={errorElegir}
          onConfirmar={() => void confirmar()}
          onCancelar={cancelar}
        >
          <p>
            ¿Quieres elegir a <strong>{elegida.afiliado.nombre}</strong> para
            esta tarea? Es una decisión definitiva: las demás ofertas se
            rechazarán y la tarea dejará de recibir postulaciones.
          </p>
        </ModalConfirmacion>
      )}
    </section>
  );
}
