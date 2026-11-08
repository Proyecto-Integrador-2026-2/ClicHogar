/**
 * Cierre de una tarea asignada por su creador (US-014).
 * - Esc 1: "Marcar como finalizada" abre la confirmación del pago en efectivo;
 *   al confirmar se finaliza, se felicita y se lleva a calificar al afiliado.
 * - Esc 4: cancelar o cerrar la ventana deja la tarea intacta.
 * - Esc 5: un fallo de conexión detiene la carga, no finaliza y avisa.
 * (Los Esc 2 y 3 los decide el servidor con `puedeFinalizar`: este componente
 * solo se muestra cuando el creador puede cerrar.)
 */
import React, { useRef, useState } from 'react';
import { obtenerToken } from '../../../lib/auth';
import {
  ErrorSesionExpirada,
  ErrorSinConexion,
  finalizarTarea,
} from '../../../lib/usuarios-api';
import './auth.css';
import ModalConfirmacion from './ModalConfirmacion';

export const MENSAJE_FINALIZADA =
  'Tarea completada. Gracias por usar ClicHogar';
export const MENSAJE_ERROR_FINALIZAR =
  'Ocurrió un error al intentar finalizar la tarea. Verifica tu conexión e intenta de nuevo.';
/** Pausa para leer el mensaje de éxito antes de ir a calificar. */
export const REDIRECCION_CALIFICAR_MS = 1500;

/** Destino del formulario de calificación de la tarea (US-016). */
export const hrefCalificar = (tareaId: string) =>
  `/calificaciones?tarea=${encodeURIComponent(tareaId)}`;

type Props = {
  tareaId: string;
  nombreAfiliado: string;
  /** Pausa antes de redirigir (solo se cambia en pruebas). */
  esperaMs?: number;
};

export default function FinalizarTarea({
  tareaId,
  nombreAfiliado,
  esperaMs = REDIRECCION_CALIFICAR_MS,
}: Readonly<Props>) {
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completada, setCompletada] = useState(false);
  // Guarda síncrona contra el doble clic.
  const enCurso = useRef(false);

  const cerrar = () => {
    setAbierto(false);
    setError(null);
  };

  const confirmar = async () => {
    if (enCurso.current) return;
    enCurso.current = true;
    setEnviando(true);
    setError(null);
    try {
      const token = obtenerToken();
      if (!token) throw new ErrorSesionExpirada();
      await finalizarTarea(token, tareaId);
      setAbierto(false);
      setCompletada(true);
      setTimeout(() => {
        window.location.href = hrefCalificar(tareaId);
      }, esperaMs);
    } catch (err: unknown) {
      if (err instanceof ErrorSesionExpirada) {
        window.location.href = '/login?expirada=1';
      } else {
        // Sin conexión o fallo inesperado: mensaje de la historia; un
        // rechazo de negocio llega con la explicación del backend.
        setError(
          err instanceof ErrorSinConexion || !(err instanceof Error)
            ? MENSAJE_ERROR_FINALIZAR
            : err.message
        );
      }
    } finally {
      enCurso.current = false;
      setEnviando(false);
    }
  };

  if (completada) {
    return (
      <p className="ch-alert" role="status">
        {MENSAJE_FINALIZADA}
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        className="ch-btn ch-btn--primary"
        onClick={() => setAbierto(true)}
      >
        Marcar como finalizada
      </button>
      {abierto && (
        <ModalConfirmacion
          titulo="Confirmar pago y finalizar"
          textoConfirmar="Confirmar pago y finalizar"
          enviando={enviando}
          error={error}
          onConfirmar={() => void confirmar()}
          onCancelar={cerrar}
        >
          <p>
            ¿Ya realizaste el pago en efectivo a {nombreAfiliado}? Al confirmar,
            la tarea se cierra y podrás calificar el servicio.
          </p>
        </ModalConfirmacion>
      )}
    </>
  );
}
