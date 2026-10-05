/**
 * Formulario de publicación de tarea (US-006): título, descripción
 * (20-1000 con contador), categoría fija y ubicación aproximada.
 * - Validación al blur y al submit con resumen enfocado (Esc 3-5).
 * - Guardia de cambios sin guardar vía `beforeunload` (Esc 6, sin
 *   React Router: MPA con navegaciones completas).
 * - 401 del backend = sesión expirada → redirect a login con aviso
 *   (Esc 7). Los valores se conservan si falla la red.
 * - Éxito (Esc 1): alerta + botón para publicar otra.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { crearTarea, ErrorSesionExpirada } from '../../../lib/usuarios-api';
import './auth.css';
import {
  ErrorSummary,
  SelectField,
  TextField,
  type FieldError,
} from './fields';
import {
  CAMPOS_TAREA,
  CATEGORIAS_TAREA,
  ETIQUETAS_TAREA,
  IDS_TAREA,
  MAX_DESCRIPCION,
  MIN_DESCRIPCION,
  validarCampoTarea,
  type ClaveErrorTarea,
} from './tarea.validation';

export default function TareaForm() {
  const { getToken } = useAuth();

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState('');
  const [ubicacion, setUbicacion] = useState('');

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [exito, setExito] = useState('');
  const [publicando, setPublicando] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  const valores = useMemo(
    () => ({ titulo, descripcion, categoria, ubicacion }),
    [titulo, descripcion, categoria, ubicacion]
  );

  const errores: Partial<Record<ClaveErrorTarea, string>> = useMemo(() => {
    const acc: Partial<Record<ClaveErrorTarea, string>> = {};
    for (const campo of CAMPOS_TAREA) {
      const mensaje = validarCampoTarea(campo, valores);
      if (mensaje) {
        acc[campo] = mensaje;
      }
    }
    return acc;
  }, [valores]);

  /** Error visible solo si el campo fue tocado o ya se intentó enviar. */
  const visible = (campo: ClaveErrorTarea): string | undefined => {
    if (!touched[campo] && !submitAttempted) return undefined;
    return errores[campo];
  };

  const resumen: FieldError[] = useMemo(() => {
    if (!submitAttempted) return [];
    return (Object.keys(errores) as Array<ClaveErrorTarea>)
      .filter((c) => errores[c])
      .map((c) => ({
        field: IDS_TAREA[c],
        label: ETIQUETAS_TAREA[c],
        message: `${ETIQUETAS_TAREA[c]}: ${errores[c]}`,
      }));
  }, [errores, submitAttempted]);

  /** Hay contenido sin publicar (Escenario 6). */
  const sucio =
    titulo.trim() !== '' ||
    descripcion.trim() !== '' ||
    categoria !== '' ||
    ubicacion.trim() !== '';

  // Guardia de navegación: el navegador confirma antes de descartar.
  useEffect(() => {
    if (!sucio || exito) return;
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [sucio, exito]);

  const marcarTocados = () =>
    setTouched({
      titulo: true,
      descripcion: true,
      categoria: true,
      ubicacion: true,
    });

  const tocar = (campo: string) =>
    setTouched((t) => (t[campo] ? t : { ...t, [campo]: true }));

  const limpiar = () => {
    setTitulo('');
    setDescripcion('');
    setCategoria('');
    setUbicacion('');
    setTouched({});
    setSubmitAttempted(false);
    setGlobalError('');
    setExito('');
  };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGlobalError('');
    setExito('');
    setSubmitAttempted(true);
    marcarTocados();

    if (Object.keys(errores).length > 0) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }

    setPublicando(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error(
          'No se pudo obtener la sesión. Recarga e inténtalo de nuevo.'
        );
      }
      await crearTarea({
        token,
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        categoria,
        ubicacion: ubicacion.trim(),
      });
      setExito('¡Tarea publicada! Los afiliados ya pueden verla.');
    } catch (err: unknown) {
      if (err instanceof ErrorSesionExpirada) {
        window.location.href = '/login?expirada=1';
        return;
      }
      setGlobalError(
        err instanceof Error
          ? err.message
          : 'No se pudo publicar tu tarea. Inténtalo de nuevo.'
      );
    } finally {
      setPublicando(false);
    }
  };

  return (
    <div className="ch-auth">
      <div className="ch-card">
        <h2 className="ch-card__title">Publica tu tarea</h2>
        <p className="ch-card__subtitle">
          Describe lo que necesitas y recibe ofertas
        </p>

        <ErrorSummary
          ref={summaryRef}
          title="Hay un problema con tu publicación"
          items={resumen}
        />

        {globalError && (
          <div className="ch-alert ch-alert--error" role="alert">
            {globalError}
          </div>
        )}

        {exito && (
          <div className="ch-alert ch-alert--exito" role="status">
            <p style={{ margin: 0 }}>{exito}</p>
            <p style={{ margin: '8px 0 0' }}>
              <button
                type="button"
                className="ch-btn ch-btn--primary"
                onClick={limpiar}
              >
                Publicar otra tarea
              </button>
            </p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="ch-form"
          noValidate
          aria-busy={publicando}
        >
          <fieldset disabled={publicando} className="ch-fieldset">
            <div className="ch-form">
              <TextField
                id={IDS_TAREA.titulo}
                label="Título"
                type="text"
                value={titulo}
                onChange={setTitulo}
                onBlur={() => tocar('titulo')}
                error={visible('titulo')}
                required
                hint="Ej. Arreglar grifo que gotea."
                autoComplete="off"
              />

              <div className="ch-field">
                <label
                  className="ch-field__label"
                  htmlFor={IDS_TAREA.descripcion}
                >
                  Descripción{' '}
                  <span className="ch-field__required" aria-hidden="true">
                    *
                  </span>
                  <span className="ch-sr-only">(obligatorio)</span>
                </label>
                <p
                  className="ch-field__hint"
                  id={`${IDS_TAREA.descripcion}-hint`}
                >
                  Detalles, medidas y lo que incluye (mínimo {MIN_DESCRIPCION}{' '}
                  caracteres).
                </p>
                <textarea
                  id={IDS_TAREA.descripcion}
                  className={`ch-field__input${visible('descripcion') ? ' ch-field__input--error' : ''}`}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  onBlur={() => tocar('descripcion')}
                  disabled={publicando}
                  required
                  maxLength={MAX_DESCRIPCION}
                  rows={5}
                  aria-invalid={visible('descripcion') ? true : undefined}
                  aria-describedby={`${IDS_TAREA.descripcion}-hint ${IDS_TAREA.descripcion}-contador ${visible('descripcion') ? IDS_TAREA.descripcion + '-error' : ''}`.trim()}
                />
                {visible('descripcion') && (
                  <p
                    className="ch-field__error"
                    id={`${IDS_TAREA.descripcion}-error`}
                  >
                    {visible('descripcion')}
                  </p>
                )}
                <p
                  className="ch-contador"
                  id={`${IDS_TAREA.descripcion}-contador`}
                >
                  {descripcion.length}/{MAX_DESCRIPCION}
                </p>
              </div>

              <SelectField
                id={IDS_TAREA.categoria}
                label="Categoría"
                value={categoria}
                onChange={setCategoria}
                onBlur={() => tocar('categoria')}
                error={visible('categoria')}
                required
                placeholder="Selecciona una categoría..."
                options={CATEGORIAS_TAREA.map((c) => ({ value: c, label: c }))}
              />

              <TextField
                id={IDS_TAREA.ubicacion}
                label="Ubicación aproximada"
                type="text"
                value={ubicacion}
                onChange={setUbicacion}
                onBlur={() => tocar('ubicacion')}
                error={visible('ubicacion')}
                required
                hint="Barrio o zona. El autocompletado con mapa llegará después."
                autoComplete="address-level2"
              />

              <button
                type="submit"
                className="ch-btn ch-btn--primary"
                disabled={publicando}
                aria-busy={publicando}
              >
                {publicando && (
                  <span className="ch-spinner" aria-hidden="true" />
                )}
                {publicando ? 'Publicando...' : 'Publicar tarea'}
              </button>
              <p className="ch-status" role="status">
                {sucio && !publicando && !exito
                  ? 'Tienes cambios sin publicar.'
                  : ''}
              </p>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
