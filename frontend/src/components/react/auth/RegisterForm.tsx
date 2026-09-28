/**
 * Formulario de registro (US-001): orquesta estado, validación y los dos
 * flujos async (Clerk `signUp` + sincronización del perfil en el backend).
 * Las reglas viven en `register.validation.ts`, los primitivos visuales en
 * `fields.tsx` y los errores de Clerk en `lib/clerk-errors.ts`.
 */
import React, { useMemo, useRef, useState } from 'react';
import { useAuth, useSignUp } from '@clerk/clerk-react';
import {
  normalizarRolParaBackend,
  sincronizarUsuarioConBackend,
} from '../../../lib/usuarios-api';
import {
  getFirstClerkError,
} from '../../../lib/clerk-errors';
import './RegisterForm.css';
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
  const { isLoaded, signUp, setActive } = useSignUp();
  const { getToken } = useAuth();

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
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
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

  const ocupado = isSubmitting || isSyncing;

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
    if (!isLoaded) return;

    setIsSubmitting(true);
    try {
      // Escenario 1 y 2: Registro exitoso como "Usuario" o "Afiliado"
      await signUp.create({
        firstName: name,
        emailAddress: email,
        password,
        unsafeMetadata: {
          rol: role, // Perfil dual: viaja en la metadata de Clerk
        },
      });

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err: unknown) {
      const clerkError = getFirstClerkError(err);

      if (clerkError?.code === 'form_identifier_exists') {
        setGlobalError(
          'Este correo ya está asociado a una cuenta. ¿Deseas iniciar sesión?'
        );
      } else {
        setGlobalError(
          clerkError?.message || 'Ocurrió un error en el registro.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!isLoaded) return;

    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (completeSignUp.status === 'complete') {
        await setActive({ session: completeSignUp.createdSessionId });

        // US-001: crear el perfil local en Postgres (idempotente).
        setIsSyncing(true);
        try {
          const token = await getToken();
          if (!token) {
            throw new Error(
              'No se pudo obtener la sesión. Recarga e inténtalo de nuevo.'
            );
          }
          const perfil = await sincronizarUsuarioConBackend({
            token,
            nombre: name,
            rol: role,
          });
          const rolBackend = normalizarRolParaBackend(perfil.rol);
          window.location.href =
            rolBackend === 'afiliado' ? '/perfil/configurar' : '/dashboard';
        } finally {
          setIsSyncing(false);
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && !('errors' in err)) {
        setGlobalError(
          `Tu cuenta se verificó, pero no se pudo crear tu perfil: ${err.message}`
        );
        return;
      }
      const clerkError = getFirstClerkError(err);

      setGlobalError(
        clerkError?.message || 'Código de verificación incorrecto.'
      );
    }
  };

  // --- Vista de Verificación ---
  if (pendingVerification) {
    return (
      <div className="ch-register">
        <div className="ch-card">
          <h2 className="ch-card__title">Verifica tu correo</h2>
          <p className="ch-card__subtitle">
            Hemos enviado un código a {email}
          </p>
          {globalError && (
            <div className="ch-alert ch-alert--error" role="alert">
              {globalError}
            </div>
          )}
          <form onSubmit={handleVerify} className="ch-form" noValidate>
            <TextField
              id={IDS.code}
              label="Código de verificación"
              type="text"
              value={code}
              onChange={setCode}
              hint="Revisa tu bandeja de entrada y pégalo aquí."
              required
              autoComplete="one-time-code"
              inputMode="numeric"
              disabled={ocupado}
            />
            <button
              type="submit"
              className="ch-btn ch-btn--primary"
              disabled={ocupado}
              aria-busy={ocupado}
            >
              {ocupado && <span className="ch-spinner" aria-hidden="true" />}
              {isSyncing ? 'Creando tu perfil...' : 'Verificar cuenta'}
            </button>
            <p className="ch-status" role="status">
              {isSyncing ? 'Guardando tu perfil en ClicHogar…' : ''}
            </p>
          </form>
        </div>
      </div>
    );
  }

  // --- Vista del Formulario de Registro ---
  return (
    <div className="ch-register">
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
                disabled={!isLoaded || ocupado}
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
