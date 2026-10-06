/**
 * Formulario de disponibilidad semanal (US-005, exclusivo Afiliados):
 * matriz 7 días × 3 franjas con toggles accesibles (Esc 1-3).
 * - Carga la matriz actual (prefill) y guarda por reemplazo total,
 *   incluso vacía para limpiar (Esc 2-3).
 * - Sin rol afiliado muestra la alerta de exclusividad (Esc 4) sin
 *   renderizar la matriz.
 * - Ante fallo de red conserva la selección y avisa sin recargar (Esc 5).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  guardarDisponibilidad,
  obtenerDisponibilidad,
  obtenerPerfil,
} from '../../../lib/usuarios-api';
import './auth.css';
import {
  alternarSlot,
  claveSlot,
  DIAS,
  FRANJAS,
  slotsAArreglo,
} from './disponibilidad.validation';

/** Palomita vectorial del slot activo (decorativa: el estado lo da aria-pressed). */
function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default function DisponibilidadForm() {
  const { getToken } = useAuth();

  const [seleccion, setSeleccion] = useState<ReadonlySet<string>>(new Set());
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [exito, setExito] = useState('');
  const [sinRol, setSinRol] = useState(false);

  // Carga inicial: matriz actual + guardia de rol (Esc 4).
  // Sin fila local o sin rol afiliado no hay matriz que pintar.
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) {
          throw new Error(
            'No se pudo obtener la sesión. Recarga e inténtalo de nuevo.'
          );
        }
        const perfil = await obtenerPerfil(token);
        if (!vivo) return;
        if (perfil.rol !== 'afiliado') {
          setSinRol(true);
          return;
        }
        const actual = await obtenerDisponibilidad(token);
        if (!vivo) return;
        setSeleccion(
          new Set(actual.map((s) => claveSlot(s.diaSemana, s.franjaHoraria)))
        );
      } catch (err: unknown) {
        if (!vivo) return;
        setGlobalError(
          err instanceof Error ? err.message : 'No se pudo cargar tu horario.'
        );
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [getToken]);

  const vacio = seleccion.size === 0;
  const ocupado = cargando || guardando;

  const mensajeExito = useMemo(
    () => (exito ? `${exito} (${seleccion.size} franjas)` : ''),
    [exito, seleccion.size]
  );

  const handleGuardar = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGlobalError('');
    setExito('');
    setGuardando(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error(
          'No se pudo obtener la sesión. Recarga e inténtalo de nuevo.'
        );
      }
      // Reemplazo total (Esc 2-3): viaja el conjunto, vacío incluido.
      const guardados = await guardarDisponibilidad({
        token,
        slots: slotsAArreglo(seleccion),
      });
      setSeleccion(
        new Set(guardados.map((s) => claveSlot(s.diaSemana, s.franjaHoraria)))
      );
      setExito(
        guardados.length === 0
          ? 'Disponibilidad eliminada.'
          : 'Disponibilidad guardada.'
      );
    } catch (err: unknown) {
      // Escenario 5: la selección local se conserva intacta.
      setGlobalError(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar tu horario. Inténtalo de nuevo.'
      );
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div className="ch-auth">
        <div className="ch-card">
          <p className="ch-status" role="status">
            Cargando tu horario…
          </p>
        </div>
      </div>
    );
  }

  // Guardia de rol (Escenario 4): mensaje + salida, sin matriz.
  if (sinRol) {
    return (
      <div className="ch-auth">
        <div className="ch-card">
          <h2 className="ch-card__title">Mi disponibilidad</h2>
          <div className="ch-alert ch-alert--error" role="alert">
            Esta sección es exclusiva para perfiles de Afiliados.{' '}
            <a href="/">Volver al inicio</a>.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ch-auth">
      <div className="ch-card">
        <h2 className="ch-card__title">Mi disponibilidad</h2>
        <p className="ch-card__subtitle">
          Marca los días y franjas en que puedes prestar servicios
        </p>

        {globalError && (
          <div className="ch-alert ch-alert--error" role="alert">
            {globalError}
          </div>
        )}

        {mensajeExito && (
          <div className="ch-alert ch-alert--exito" role="status">
            {mensajeExito}
          </div>
        )}

        <form
          onSubmit={handleGuardar}
          className="ch-form"
          noValidate
          aria-busy={ocupado}
        >
          <fieldset disabled={ocupado} className="ch-fieldset">
            <div
              className="ch-matriz"
              role="group"
              aria-label="Días y franjas disponibles"
            >
              <div
                className="ch-matriz__fila ch-matriz__cabecera"
                aria-hidden="true"
              >
                <span />
                {FRANJAS.map((f) => (
                  <span key={f.valor}>{f.etiqueta}</span>
                ))}
              </div>
              {DIAS.map((dia) => (
                <div className="ch-matriz__fila" key={dia.valor}>
                  <span className="ch-matriz__dia">{dia.etiqueta}</span>
                  {FRANJAS.map((franja) => {
                    const activo = seleccion.has(
                      claveSlot(dia.valor, franja.valor)
                    );
                    return (
                      <button
                        key={franja.valor}
                        type="button"
                        className={`ch-slot${activo ? ' ch-slot--activo' : ''}`}
                        aria-pressed={activo}
                        aria-label={`${dia.etiqueta} ${franja.etiqueta}: ${activo ? 'disponible' : 'no disponible'}`}
                        onClick={() =>
                          setSeleccion((s) =>
                            alternarSlot(s, dia.valor, franja.valor)
                          )
                        }
                      >
                        {activo ? <CheckIcon /> : ''}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {vacio && (
              <p className="ch-field__hint">
                Sin disponibilidad definida: no aparecerás en búsquedas por
                horario.
              </p>
            )}

            <button
              type="submit"
              className="ch-btn ch-btn--primary"
              disabled={ocupado}
              aria-busy={ocupado}
            >
              {guardando && <span className="ch-spinner" aria-hidden="true" />}
              {guardando ? 'Guardando...' : 'Guardar horario'}
            </button>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
