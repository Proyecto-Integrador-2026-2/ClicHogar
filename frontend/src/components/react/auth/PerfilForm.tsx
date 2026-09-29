/**
 * Formulario de perfil público (US-004): foto (JPG/PNG ≤5MB con vista
 * previa), descripción (≤500 con contador) y ubicación aproximada.
 * Carga los valores actuales, envía SOLO lo modificado (Escenario 2),
 * conserva datos si falla la red (Escenario 7), celebra el éxito
 * (Escenario 1) y advierte cambios sin guardar al salir (Escenario 6,
 * vía `beforeunload`: no hay router SPA que interceptar).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  actualizarPerfil,
  obtenerPerfil,
  urlPublica,
  type UsuarioPublico,
} from '../../../lib/usuarios-api';
import './auth.css';
import {
  ErrorSummary,
  FileField,
  TextField,
  type FieldError,
} from './fields';
import {
  CAMPOS_PERFIL,
  ETIQUETAS_PERFIL,
  IDS_PERFIL,
  MAX_DESCRIPCION,
  validarCampoPerfil,
  type ClaveErrorPerfil,
} from './perfil.validation';

type Snapshot = {
  fotoUrl: string | null;
  descripcion: string;
  ubicacion: string;
};

export default function PerfilForm() {
  const { getToken } = useAuth();

  const [foto, setFoto] = useState<File | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [inicial, setInicial] = useState<Snapshot | null>(null);

  const [cargando, setCargando] = useState(true);
  const [sinPerfil, setSinPerfil] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [exito, setExito] = useState('');
  const [guardando, setGuardando] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  // Carga inicial: pre-rellena y congela la foto de referencia para el
  // diff parcial y la guardia de cambios sin guardar.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const token = await getToken();
        if (!token) {
          throw new Error(
            'No se pudo obtener la sesión. Recarga e inténtalo de nuevo.'
          );
        }
        const perfil: UsuarioPublico = await obtenerPerfil(token);
        if (!vivo) return;
        const fotoUrl = perfil.fotoUrl ?? null;
        setDescripcion(perfil.descripcion ?? '');
        setUbicacion(perfil.ubicacion ?? '');
        setInicial({
          fotoUrl,
          descripcion: perfil.descripcion ?? '',
          ubicacion: perfil.ubicacion ?? '',
        });
        setVistaPrevia(fotoUrl ? urlPublica(fotoUrl) : null);
      } catch (err: unknown) {
        if (!vivo) return;
        const mensaje =
          err instanceof Error ? err.message : 'No se pudo cargar tu perfil.';
        // Sin fila local (404 de GET /yo): se invita a registrarse en vez
        // de mostrar un error técnico.
        if (mensaje.includes('perfil local') || mensaje.includes('404')) {
          setSinPerfil(true);
        } else {
          setGlobalError(mensaje);
        }
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [getToken]);

  // Vista previa local de la foto elegida (se libera al cambiar).
  useEffect(() => {
    if (!foto) return;
    const url = URL.createObjectURL(foto);
    setVistaPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [foto]);

  const errores: Partial<Record<ClaveErrorPerfil, string>> = useMemo(() => {
    const valores = { foto, descripcion, ubicacion };
    const acc: Partial<Record<ClaveErrorPerfil, string>> = {};
    for (const campo of CAMPOS_PERFIL) {
      const mensaje = validarCampoPerfil(campo, valores);
      if (mensaje) {
        acc[campo] = mensaje;
      }
    }
    return acc;
  }, [foto, descripcion, ubicacion]);

  /** Error visible solo si el campo fue tocado o ya se intentó enviar. */
  const visible = (campo: ClaveErrorPerfil): string | undefined => {
    if (!touched[campo] && !submitAttempted) return undefined;
    return errores[campo];
  };

  const resumen: FieldError[] = useMemo(() => {
    if (!submitAttempted) return [];
    return (Object.keys(errores) as Array<ClaveErrorPerfil>)
      .filter((c) => errores[c])
      .map((c) => ({
        field: IDS_PERFIL[c],
        label: ETIQUETAS_PERFIL[c],
        message: `${ETIQUETAS_PERFIL[c]}: ${errores[c]}`,
      }));
  }, [errores, submitAttempted]);

  /** Hay cambios sin guardar (Escenario 6). */
  const sucio =
    inicial !== null &&
    (foto !== null ||
      descripcion !== inicial.descripcion ||
      ubicacion !== inicial.ubicacion);

  // Guardia de navegación: el navegador confirma antes de descartar.
  useEffect(() => {
    if (!sucio) return;
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [sucio]);

  const tocar = (campo: string) =>
    setTouched((t) => (t[campo] ? t : { ...t, [campo]: true }));

  const ocupado = cargando || guardando;

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGlobalError('');
    setExito('');
    setSubmitAttempted(true);

    if (Object.keys(errores).length > 0) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    if (!sucio || !inicial) return;

    setGuardando(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error(
          'No se pudo obtener la sesión. Recarga e inténtalo de nuevo.'
        );
      }
      // Parcial (Escenario 2): solo viaja lo modificado.
      const perfil = await actualizarPerfil({
        token,
        ...(foto ? { foto } : {}),
        ...(descripcion !== inicial.descripcion ? { descripcion } : {}),
        ...(ubicacion !== inicial.ubicacion ? { ubicacion } : {}),
      });
      const fotoUrl = perfil.fotoUrl ?? null;
      setInicial({
        fotoUrl,
        descripcion: perfil.descripcion ?? '',
        ubicacion: perfil.ubicacion ?? '',
      });
      setFoto(null);
      setVistaPrevia(fotoUrl ? urlPublica(fotoUrl) : null);
      setExito('Perfil actualizado correctamente.');
    } catch (err: unknown) {
      // Escenario 7: los valores se conservan, solo se informa el fallo.
      setGlobalError(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar tu perfil. Inténtalo de nuevo.'
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
            Cargando tu perfil…
          </p>
        </div>
      </div>
    );
  }

  if (sinPerfil) {
    return (
      <div className="ch-auth">
        <div className="ch-card">
          <h2 className="ch-card__title">Completa tu perfil</h2>
          <div className="ch-alert ch-alert--error" role="alert">
            Aún no tienes perfil local.{' '}
            <a href="/register">Crea tu cuenta primero</a>.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ch-auth">
      <div className="ch-card">
        <h2 className="ch-card__title">Completa tu perfil</h2>
        <p className="ch-card__subtitle">
          Una foto, una descripción y tu zona generan confianza
        </p>

        <ErrorSummary
          ref={summaryRef}
          title="Hay un problema con tu perfil"
          items={resumen}
        />

        {globalError && (
          <div className="ch-alert ch-alert--error" role="alert">
            {globalError}
          </div>
        )}

        {exito && (
          <div
            className="ch-alert ch-alert--exito"
            role="status"
          >
            {exito}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="ch-form"
          noValidate
          aria-busy={ocupado}
        >
          <fieldset disabled={ocupado} className="ch-fieldset">
            <div className="ch-form">
              <div className="ch-field">
                {vistaPrevia && (
                  <img
                    className="ch-foto-preview"
                    src={vistaPrevia}
                    alt="Vista previa de tu foto de perfil"
                  />
                )}
                <FileField
                  id={IDS_PERFIL.foto}
                  label="Foto de perfil"
                  accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                  onChange={setFoto}
                  onBlur={() => tocar('foto')}
                  error={visible('foto')}
                  hint="JPG o PNG de máximo 5MB."
                  disabled={ocupado}
                />
              </div>

              <div className="ch-field">
                <label
                  className="ch-field__label"
                  htmlFor={IDS_PERFIL.descripcion}
                >
                  Descripción
                </label>
                <p
                  className="ch-field__hint"
                  id={`${IDS_PERFIL.descripcion}-hint`}
                >
                  Cuéntales a otros usuarios sobre ti y tu experiencia.
                </p>
                <textarea
                  id={IDS_PERFIL.descripcion}
                  className="ch-field__input"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  onBlur={() => tocar('descripcion')}
                  disabled={ocupado}
                  maxLength={MAX_DESCRIPCION}
                  rows={4}
                  aria-describedby={`${IDS_PERFIL.descripcion}-hint ${IDS_PERFIL.descripcion}-contador`}
                />
                <p
                  className="ch-contador"
                  id={`${IDS_PERFIL.descripcion}-contador`}
                >
                  {descripcion.length}/{MAX_DESCRIPCION}
                </p>
              </div>

              <TextField
                id={IDS_PERFIL.ubicacion}
                label="Ubicación aproximada"
                type="text"
                value={ubicacion}
                onChange={setUbicacion}
                onBlur={() => tocar('ubicacion')}
                error={visible('ubicacion')}
                hint="Barrio o zona, nunca tu dirección exacta."
                autoComplete="address-level2"
              />

              <button
                type="submit"
                className="ch-btn ch-btn--primary"
                disabled={ocupado || !sucio}
                aria-busy={ocupado}
              >
                {guardando && (
                  <span className="ch-spinner" aria-hidden="true" />
                )}
                {guardando ? 'Guardando...' : 'Guardar perfil'}
              </button>
              <p className="ch-status" role="status">
                {sucio && !guardando
                  ? 'Tienes cambios sin guardar.'
                  : ''}
              </p>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
