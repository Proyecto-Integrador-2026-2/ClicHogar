/**
 * Formulario de registro (US-001): orquesta estado, validación y el alta
 * de la cuenta en el backend (`POST /api/auth/register`). Las reglas
 * viven en `register.validation.ts` y los primitivos visuales en
 * `fields.tsx`.
 */
import React, { useMemo, useRef, useState } from 'react';
import { registrar, normalizarRolParaBackend } from '../../../lib/usuarios-api';
import { guardarToken } from '../../../lib/auth';
import './auth.css';
import {
  CheckField,
  ErrorSummary,
  PasswordField,
  SelectField,
  TextField,
  type FieldError,
} from './fields';
import {
  CAMPOS_VALIDABLES,
  ETIQUETAS,
  IDS,
  validarCampo,
  type ClaveError,
  type Role,
  type Valores,
} from './register.validation';

export default function RegisterForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<Role>('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // touched por campo (validación al blur, skill ux) + intento de envío.
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  const valores: Valores = useMemo(
    () => ({ name, email, password, confirmPassword, role, termsAccepted }),
    [name, email, password, confirmPassword, role, termsAccepted]
  );

  const errores: Partial<Record<ClaveError, string>> = useMemo(() => {
    const v = valores;
    const acc: Partial<Record<ClaveError, string>> = {};
    for (const campo of CAMPOS_VALIDABLES) {
      const mensaje = validarCampo(campo, v);
      if (mensaje) {
        acc[campo] = mensaje;
      }
    }
    return acc;
  }, [valores]);

  /** Error visible solo si el campo fue tocado o ya se intentó enviar. */
  const visible = (campo: ClaveError): string | undefined => {
    const key = campo === 'terms' ? 'terms' : campo;
    if (!touched[key] && !submitAttempted) return undefined;
    return errores[campo];
  };

  const resumen: FieldError[] = useMemo(() => {
    if (!submitAttempted) return [];
    return (Object.keys(errores) as Array<ClaveError>)
      .filter((c) => errores[c])
      .map((c) => ({
        field: c === 'terms' ? IDS.terms : IDS[c],
        label: ETIQUETAS[c],
        message: `${ETIQUETAS[c]}: ${errores[c]}`,
      }));
  }, [errores, submitAttempted]);

  const marcarTocados = () =>
    setTouched({
      name: true,
      email: true,
      password: true,
      confirmPassword: true,
      role: true,
      terms: true,
    });

  const tocar = (campo: string) =>
    setTouched((t) => (t[campo] ? t : { ...t, [campo]: true }));

  const ocupado = isSubmitting;

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGlobalError('');
    setSubmitAttempted(true);
    marcarTocados();

    if (Object.keys(errores).length > 0) {
      // Foco al resumen (skill ux Result 1); inline errors se conservan.
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setIsSubmitting(true);
    try {
      const resp = await registrar({
        nombre: name,
        email,
        password,
        rol: role,
      });
      guardarToken(resp.token);
      const rolBackend = normalizarRolParaBackend(resp.usuario.rol);
      window.location.href =
        rolBackend === 'afiliado' ? '/perfil/configurar' : '/dashboard';
    } catch (err: unknown) {
      setGlobalError(
        err instanceof Error ? err.message : 'Ocurrió un error en el registro.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Vista del Formulario de Registro ---
  return (
    <div className="ch-auth">
      <div className="ch-card">
        <h2 className="ch-card__title">Únete a Clic Hogar</h2>
        <p className="ch-card__subtitle">
          Crea tu cuenta para pedir u ofrecer servicios
        </p>

        <ErrorSummary
          ref={summaryRef}
          title="Hay un problema con tu registro"
          items={resumen}
        />

        {globalError && (
          <div className="ch-alert ch-alert--error" role="alert">
            {globalError}
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
              <TextField
                id={IDS.name}
                label="Nombre completo"
                type="text"
                value={name}
                onChange={setName}
                onBlur={() => tocar('name')}
                error={visible('name')}
                required
                autoComplete="name"
              />

              <SelectField
                id={IDS.role}
                label="¿Cómo quieres usar la plataforma?"
                value={role}
                onChange={(v) =>
                  setRole(v === 'Usuario' || v === 'Afiliado' ? v : '')
                }
                onBlur={() => tocar('role')}
                error={visible('role')}
                required
                placeholder="Selecciona tu rol..."
                options={[
                  { value: 'Usuario', label: 'Busco servicios (Usuario)' },
                  { value: 'Afiliado', label: 'Ofrezco servicios (Afiliado)' },
                ]}
              />

              <TextField
                id={IDS.email}
                label="Correo electrónico"
                type="email"
                value={email}
                onChange={setEmail}
                onBlur={() => tocar('email')}
                error={visible('email')}
                required
                autoComplete="email"
                inputMode="email"
              />

              <PasswordField
                id={IDS.password}
                label="Contraseña"
                value={password}
                onChange={setPassword}
                onBlur={() => tocar('password')}
                error={visible('password')}
                hint="Mínimo 8 caracteres, con al menos una mayúscula y un número."
                autoComplete="new-password"
              />

              <PasswordField
                id={IDS.confirmPassword}
                label="Confirmar contraseña"
                value={confirmPassword}
                onChange={setConfirmPassword}
                onBlur={() => tocar('confirmPassword')}
                error={visible('confirmPassword')}
                autoComplete="new-password"
              />

              <CheckField
                id={IDS.terms}
                label="Acepto los Términos, Condiciones y Política de Datos"
                checked={termsAccepted}
                onChange={setTermsAccepted}
                onBlur={() => tocar('terms')}
                error={visible('terms')}
                disabled={ocupado}
              />

              <button
                type="submit"
                className="ch-btn ch-btn--primary"
                disabled={ocupado}
                aria-busy={ocupado}
              >
                {ocupado && <span className="ch-spinner" aria-hidden="true" />}
                {isSubmitting ? 'Creando tu cuenta...' : 'Crear cuenta'}
              </button>
              <p className="ch-status" role="status">
                {isSubmitting ? 'Contactando el servicio de registro…' : ''}
              </p>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
