/**
 * Primitivos visuales del formulario (US-001): cada campo rinde etiqueta,
 * pista, control y error inline conectados por `aria-describedby`, más
 * `aria-invalid` en estado de error. Los iconos son SVG propios y
 * decorativos (`aria-hidden`). Estilos en `RegisterForm.css`.
 */
import React, { useId, useState } from 'react';
import type { ReactNode } from 'react';

/** Error visible del resumen superior: enlaza al campo por su id. */
export type FieldError = {
  field: string;
  label: string;
  message: string;
};

type BaseProps = {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
};

/** Iconos vectoriales propios (sin emojis): decorativos => aria-hidden. */
function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M17.94 17.94A10.6 10.6 0 0 1 12 19c-6.5 0-10-7-10-7a17.6 17.6 0 0 1 4.06-4.94" />
      <path d="M9.9 4.24A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.7 17.7 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function describedBy(
  hintId: string,
  errorId: string,
  error?: string,
  hint?: string
): string | undefined {
  const ids = [hint && hintId, error && errorId].filter(Boolean).join(' ');
  return ids || undefined;
}

/**
 * Envoltorio común de un campo: etiqueta (con marca de obligatorio), pista,
 * el control y el error inline. Los ids de pista y error los generan los
 * campos para conectarlos con `aria-describedby`.
 */
function Campo(props: {
  id: string;
  label: string;
  obligatorio?: boolean;
  hint?: string;
  hintId: string;
  error?: string;
  errorId: string;
  children: ReactNode;
}) {
  return (
    <div className="ch-field">
      <label className="ch-field__label" htmlFor={props.id}>
        {props.label}{' '}
        {props.obligatorio && (
          <span className="ch-field__required" aria-hidden="true">
            *
          </span>
        )}
        {props.obligatorio && <span className="ch-sr-only">(obligatorio)</span>}
      </label>
      {props.hint && (
        <p className="ch-field__hint" id={props.hintId}>
          {props.hint}
        </p>
      )}
      {props.children}
      {props.error && (
        <p className="ch-field__error" id={props.errorId}>
          {props.error}
        </p>
      )}
    </div>
  );
}

/** Atributos de accesibilidad y estilo que comparten todos los controles. */
function atributosControl(
  props: BaseProps,
  hintId: string,
  errorId: string
): {
  className: string;
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
} {
  return {
    className: `ch-field__input${props.error ? ' ch-field__input--error' : ''}`,
    'aria-invalid': props.error ? true : undefined,
    'aria-describedby': describedBy(hintId, errorId, props.error, props.hint),
  };
}

export function TextField(
  props: BaseProps & {
    type: 'text' | 'email';
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    disabled?: boolean;
    autoComplete?: string;
    inputMode?: 'text' | 'email' | 'numeric';
  }
) {
  const hintId = useId();
  const errorId = useId();
  return (
    <Campo
      {...props}
      obligatorio={props.required}
      hintId={hintId}
      errorId={errorId}
    >
      <input
        {...atributosControl(props, hintId, errorId)}
        id={props.id}
        type={props.type}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        onBlur={props.onBlur}
        disabled={props.disabled}
        required={props.required}
        autoComplete={props.autoComplete}
        inputMode={props.inputMode}
      />
    </Campo>
  );
}

export function PasswordField(
  props: BaseProps & {
    value: string;
    onChange: (value: string) => void;
    onBlur: () => void;
    disabled?: boolean;
    autoComplete?: string;
  }
) {
  const [visible, setVisible] = useState(false);
  const hintId = useId();
  const errorId = useId();
  return (
    <Campo {...props} obligatorio hintId={hintId} errorId={errorId}>
      <div className="ch-input-wrap">
        <input
          {...atributosControl(props, hintId, errorId)}
          id={props.id}
          type={visible ? 'text' : 'password'}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          onBlur={props.onBlur}
          disabled={props.disabled}
          required
          autoComplete={props.autoComplete ?? 'new-password'}
        />
        <button
          type="button"
          className="ch-icon-btn"
          onClick={() => setVisible((v) => !v)}
          disabled={props.disabled}
          aria-pressed={visible}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </Campo>
  );
}

export function SelectField(
  props: BaseProps & {
    value: string;
    onChange: (value: string) => void;
    onBlur: () => void;
    disabled?: boolean;
    options: Array<{ value: string; label: string }>;
    placeholder: string;
  }
) {
  const hintId = useId();
  const errorId = useId();
  return (
    <Campo
      {...props}
      obligatorio={props.required}
      hintId={hintId}
      errorId={errorId}
    >
      <div className="ch-select-wrap">
        <select
          {...atributosControl(props, hintId, errorId)}
          id={props.id}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          onBlur={props.onBlur}
          disabled={props.disabled}
          required={props.required}
        >
          <option value="">{props.placeholder}</option>
          {props.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronIcon />
      </div>
    </Campo>
  );
}

export function FileField(
  props: BaseProps & {
    accept: string;
    onChange: (archivo: File | null) => void;
    onBlur: () => void;
    disabled?: boolean;
  }
) {
  const hintId = useId();
  const errorId = useId();
  return (
    <Campo {...props} hintId={hintId} errorId={errorId}>
      <input
        {...atributosControl(props, hintId, errorId)}
        id={props.id}
        type="file"
        accept={props.accept}
        onChange={(e) => props.onChange(e.target.files?.[0] ?? null)}
        onBlur={props.onBlur}
        disabled={props.disabled}
      />
    </Campo>
  );
}

export function CheckField(props: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  onBlur: () => void;
  disabled?: boolean;
  error?: string;
}) {
  const errorId = useId();
  return (
    <div className="ch-field">
      <div className="ch-check">
        <input
          id={props.id}
          className="ch-check__input"
          type="checkbox"
          checked={props.checked}
          onChange={(e) => props.onChange(e.target.checked)}
          onBlur={props.onBlur}
          disabled={props.disabled}
          aria-invalid={props.error ? true : undefined}
          aria-describedby={props.error ? errorId : undefined}
        />
        <label className="ch-check__label" htmlFor={props.id}>
          {props.label}
        </label>
      </div>
      {props.error && (
        <p className="ch-field__error" id={errorId}>
          {props.error}
        </p>
      )}
    </div>
  );
}

/**
 * Resumen de errores (skill ux Result 1): aparece solo tras un submit
 * fallido, recibe el foco y enlaza cada ítem con su campo.
 * El padre le pasa `ref` para mover el foco programáticamente.
 */
export const ErrorSummary = React.forwardRef<
  HTMLDivElement,
  { title: string; items: FieldError[] }
>(function ErrorSummary({ title, items }, ref) {
  if (items.length === 0) return null;
  return (
    <div
      ref={ref}
      className="ch-alert ch-alert--error"
      role="alert"
      tabIndex={-1}
      aria-labelledby="ch-error-title"
    >
      <h2 className="ch-alert__title" id="ch-error-title">
        {title}
      </h2>
      <ul className="ch-alert__list">
        {items.map((item) => (
          <li key={item.field}>
            <a href={`#${item.field}`}>{item.message}</a>
          </li>
        ))}
      </ul>
    </div>
  );
});
