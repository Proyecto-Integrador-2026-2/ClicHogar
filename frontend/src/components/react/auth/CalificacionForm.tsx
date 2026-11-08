/**
 * Calificación del servicio de una tarea finalizada (US-016).
 * - Esc 1: estrellas + reseña; al enviar se agradece y se vincula al perfil
 *   del afiliado.
 * - Esc 2: la reseña es opcional.
 * - Esc 3: sin estrellas no se envía y se resalta la sección.
 * - Esc 4: la reseña no pasa del límite (se bloquea la entrada).
 * - Esc 5: si ya se calificó, el formulario se bloquea con su mensaje.
 * - Esc 6: "Calificar más tarde" vuelve a Mis solicitudes, donde queda la
 *   calificación pendiente.
 * La tarea llega en `?tarea=<uuid>` (la deja la finalización).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { estaFirmado, obtenerToken } from '../../../lib/auth';
import {
  ErrorSesionExpirada,
  ErrorSinConexion,
  ErrorYaCalificada,
  crearCalificacion,
  obtenerFormularioCalificacion,
  type FormularioCalificacionApi,
} from '../../../lib/usuarios-api';
import './auth.css';
import {
  AlertaConReintento,
  PantallaCargando,
  PantallaSinSesion,
} from './carga-sesion';
import SelectorEstrellas from './SelectorEstrellas';

export const LIMITE_RESENA = 500;
export const MENSAJE_GRACIAS =
  'Gracias por calificar el servicio. Tu opinión ayuda a la comunidad.';
export const MENSAJE_FALTAN_ESTRELLAS =
  'Por favor, selecciona una calificación de estrellas para continuar';
export const MENSAJE_YA_CALIFICASTE =
  'Ya has enviado tu valoración para esta tarea anteriormente.';
export const MENSAJE_ERROR_CALIFICAR =
  'No pudimos enviar tu calificación. Verifica tu conexión e intenta de nuevo.';
export const MENSAJE_ERROR_FORMULARIO =
  'No pudimos cargar el formulario. Por favor, verifica tu conexión e intenta nuevamente';
export const MENSAJE_SIN_TAREA =
  'No encontramos la tarea que quieres calificar. Ábrela desde Mis solicitudes.';

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'listo'; formulario: FormularioCalificacionApi }
  /** No se puede calificar (no es tuya, no está finalizada, no existe…). */
  | { tipo: 'no-permitido'; mensaje: string }
  | { tipo: 'error' };

/** Id de la tarea en `?tarea=` (cadena vacía si falta o no se puede leer). */
function tareaDeLaUrl(): string {
  try {
    return new URLSearchParams(window.location.search).get('tarea') ?? '';
  } catch {
    return '';
  }
}

export default function CalificacionForm() {
  const [tareaId] = useState(tareaDeLaUrl);
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  const [puntuacion, setPuntuacion] = useState(0);
  const [resena, setResena] = useState('');
  const [errorEstrellas, setErrorEstrellas] = useState('');
  const [errorEnvio, setErrorEnvio] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const enCurso = useRef(false);

  const cargar = useCallback(async () => {
    if (!tareaId) {
      setEstado({ tipo: 'no-permitido', mensaje: MENSAJE_SIN_TAREA });
      return;
    }
    setEstado({ tipo: 'cargando' });
    try {
      const token = obtenerToken();
      if (!token) throw new ErrorSesionExpirada();
      setEstado({
        tipo: 'listo',
        formulario: await obtenerFormularioCalificacion(token, tareaId),
      });
    } catch (err: unknown) {
      if (err instanceof ErrorSesionExpirada) {
        window.location.href = '/login?expirada=1';
      } else if (err instanceof ErrorSinConexion || !(err instanceof Error)) {
        setEstado({ tipo: 'error' });
      } else {
        // El backend explicó por qué no se puede calificar.
        setEstado({ tipo: 'no-permitido', mensaje: err.message });
      }
    }
  }, [tareaId]);

  useEffect(() => {
    if (estaFirmado()) void cargar();
  }, [cargar]);

  const enviar = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (enCurso.current || estado.tipo !== 'listo') return;
    if (puntuacion === 0) {
      setErrorEstrellas(MENSAJE_FALTAN_ESTRELLAS);
      return;
    }
    enCurso.current = true;
    setEnviando(true);
    setErrorEnvio('');
    try {
      const token = obtenerToken();
      if (!token) throw new ErrorSesionExpirada();
      await crearCalificacion({
        token,
        tareaId,
        puntuacion,
        comentario: resena,
      });
      setEnviada(true);
    } catch (err: unknown) {
      if (err instanceof ErrorSesionExpirada) {
        window.location.href = '/login?expirada=1';
      } else if (err instanceof ErrorYaCalificada) {
        setEstado({
          tipo: 'listo',
          formulario: { ...estado.formulario, yaCalificada: true },
        });
      } else {
        setErrorEnvio(
          err instanceof ErrorSinConexion || !(err instanceof Error)
            ? MENSAJE_ERROR_CALIFICAR
            : err.message
        );
      }
    } finally {
      enCurso.current = false;
      setEnviando(false);
    }
  };

  if (!estaFirmado()) {
    return (
      <PantallaSinSesion
        titulo="Calificar el servicio"
        subtitulo="Inicia sesión para calificar el servicio."
      />
    );
  }
  if (estado.tipo === 'cargando') {
    return <PantallaCargando texto="Cargando el formulario…" />;
  }
  if (estado.tipo === 'error') {
    return (
      <div className="ch-auth">
        <div className="ch-card">
          <AlertaConReintento
            mensaje={MENSAJE_ERROR_FORMULARIO}
            onReintentar={() => void cargar()}
          />
        </div>
      </div>
    );
  }
  if (estado.tipo === 'no-permitido') {
    return (
      <div className="ch-auth">
        <div className="ch-card">
          <div className="ch-alert ch-alert--error" role="alert">
            {estado.mensaje}
          </div>
          <a className="ch-btn ch-btn--primary" href="/tareas/mias">
            Ir a mis solicitudes
          </a>
        </div>
      </div>
    );
  }

  const { formulario } = estado;
  if (formulario.yaCalificada && !enviada) {
    return (
      <div className="ch-auth">
        <div className="ch-card">
          <div className="ch-alert" role="status">
            {MENSAJE_YA_CALIFICASTE}
          </div>
          <a className="ch-btn ch-btn--primary" href="/tareas/mias">
            Ir a mis solicitudes
          </a>
        </div>
      </div>
    );
  }
  if (enviada) {
    return (
      <div className="ch-auth">
        <div className="ch-card">
          <div className="ch-alert" role="status">
            {MENSAJE_GRACIAS}
          </div>
          <a
            className="ch-btn ch-btn--ghost"
            href={`/perfil/publico?id=${encodeURIComponent(formulario.afiliado.id)}`}
          >
            Ver el perfil de {formulario.afiliado.nombre}
          </a>
          <a className="ch-btn ch-btn--primary" href="/tareas/mias">
            Ir a mis solicitudes
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="ch-auth">
      <div className="ch-card ch-card--wide">
        <h2 className="ch-card__title">Califica el servicio</h2>
        <p className="ch-card__subtitle">
          {formulario.afiliado.nombre} realizó «{formulario.titulo}»
        </p>
        <form
          onSubmit={enviar}
          className="ch-form"
          noValidate
          aria-busy={enviando}
        >
          <SelectorEstrellas
            valor={puntuacion}
            onCambio={(n) => {
              setPuntuacion(n);
              setErrorEstrellas('');
            }}
            error={errorEstrellas}
            disabled={enviando}
          />
          <label className="ch-field">
            <span className="ch-field__label">Reseña (opcional)</span>
            <textarea
              className="ch-input"
              rows={4}
              maxLength={LIMITE_RESENA}
              value={resena}
              onChange={(e) => setResena(e.target.value)}
              placeholder="Cuéntanos cómo fue tu experiencia con el prestador."
              disabled={enviando}
            />
            <span className="ch-field__hint">
              {resena.length}/{LIMITE_RESENA}
            </span>
          </label>
          {errorEnvio && (
            <div className="ch-alert ch-alert--error" role="alert">
              {errorEnvio}
            </div>
          )}
          <div className="ch-tarea__actions">
            <button
              type="submit"
              className="ch-btn ch-btn--primary"
              disabled={enviando}
              aria-busy={enviando}
            >
              {enviando ? 'Enviando…' : 'Enviar calificación'}
            </button>
            <a className="ch-btn ch-btn--ghost" href="/tareas/mias">
              Calificar más tarde
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
