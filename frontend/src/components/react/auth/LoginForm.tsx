/**
 * Formulario de inicio de sesión (US-002): orquesta estado, validación en
 * tiempo real (Esc 5-6), saneamiento (Esc 7/8), autenticación Clerk y
 * redirección a edición de perfil (los paneles por rol llegan en US
 * futuras). Errores genéricos sin revelar qué dato falló (Esc 3-4) y
 * alerta de bloqueo temporal (Esc 9). Primitivos visuales en `fields.tsx`.
 */
import React, { useMemo, useRef, useState } from 'react';
import { useAuth, useSignIn } from '@clerk/clerk-react';
import {
  clasificarErrorSignIn,
  mensajeErrorSignIn,
} from '../../../lib/clerk-errors';
import { obtenerPerfil } from '../../../lib/usuarios-api';
import './auth.css';
import {
  ErrorSummary,
  PasswordField,
  TextField,
  type FieldError,
} from './fields';
import {
  CAMPOS_LOGIN,
  ETIQUETAS_LOGIN,
  IDS_LOGIN,
  sanearEmail,
  validarCampoLogin,
  type ClaveErrorLogin,
  type ValoresLogin,
} from './login.validation';

export default function LoginForm() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const { getToken } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // touched por campo (validación al blur) + intento de envío.
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  const valores: ValoresLogin = useMemo(
    () => ({ email, password }),
    [email, password]
  );

  const errores: Partial<Record<ClaveErrorLogin, string>> = useMemo(() => {
    const acc: Partial<Record<ClaveErrorLogin, string>> = {};
    for (const campo of CAMPOS_LOGIN) {
      const mensaje = validarCampoLogin(campo, valores);
      if (mensaje) {
        acc[campo] = mensaje;
      }
    }
    return acc;
  }, [valores]);

  /** Error visible solo si el campo fue tocado o ya se intentó enviar. */
  const visible = (campo: ClaveErrorLogin): string | undefined => {
    if (!touched[campo] && !submitAttempted) return undefined;
    return errores[campo];
  };

  const resumen: FieldError[] = useMemo(() => {
    if (!submitAttempted) return [];
    return (Object.keys(errores) as Array<ClaveErrorLogin>)
      .filter((c) => errores[c])
      .map((c) => ({
        field: IDS_LOGIN[c],
        label: ETIQUETAS_LOGIN[c],
        message: `${ETIQUETAS_LOGIN[c]}: ${errores[c]}`,
      }));
  }, [errores, submitAttempted]);

  const marcarTocados = () => setTouched({ email: true, password: true });

  const tocar = (campo: string) =>
    setTouched((t) => (t[campo] ? t : { ...t, [campo]: true }));

  const ocupado = isSubmitting || isRedirecting;

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGlobalError('');
    setSubmitAttempted(true);
    marcarTocados();

    if (Object.keys(errores).length > 0) {
      // Foco al resumen; inline errors se conservan.
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    if (!isLoaded) return;

    setIsSubmitting(true);
    try {
      // Saneamiento (Esc 7/8): sin espacios ni mayúsculas antes de enviar.
      const resultado = await signIn.create({
        identifier: sanearEmail(email),
        password,
      });

      // Clerk puede pedir segundo factor u otros pasos: solo se avanza
      // con sesión completa; el resto se informa en vez de quedarse mudo.
      if (resultado.status !== 'complete') {
        setGlobalError(
          'No se pudo completar el inicio de sesión. Inténtalo de nuevo.'
        );
        return;
      }
      await setActive({ session: resultado.createdSessionId });

      // Redirección post-login: a edición de perfil hasta que existan
      // los paneles por rol (US futuras). Se lee el perfil para exigir
      // fila local sincronizada (404 → error visible, no redirect mudo).
      setIsRedirecting(true);
      try {
        const token = await getToken();
        if (!token) {
          throw new Error(
            'No se pudo obtener la sesión. Recarga e inténtalo de nuevo.'
          );
        }
        await obtenerPerfil(token);
        window.location.href = '/perfil/configurar';
      } finally {
        setIsRedirecting(false);
      }
    } catch (err: unknown) {
      // Genérico a propósito (Esc 3-4): jamás revela si falló el correo
      // o la contraseña. El bloqueo temporal tiene mensaje propio (Esc 9).
      setGlobalError(mensajeErrorSignIn(clasificarErrorSignIn(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ch-auth">
      <div className="ch-card">
        <h2 className="ch-card__title">Bienvenido de nuevo</h2>
        <p className="ch-card__subtitle">
          Inicia sesión para gestionar tus servicios
        </p>

        <ErrorSummary
          ref={summaryRef}
          title="Hay un problema con tu inicio de sesión"
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
                id={IDS_LOGIN.email}
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
                id={IDS_LOGIN.password}
                label="Contraseña"
                value={password}
                onChange={setPassword}
                onBlur={() => tocar('password')}
                error={visible('password')}
                autoComplete="current-password"
              />

              <button
                type="submit"
                className="ch-btn ch-btn--primary"
                disabled={!isLoaded || ocupado}
                aria-busy={ocupado}
              >
                {ocupado && <span className="ch-spinner" aria-hidden="true" />}
                {isSubmitting ? 'Verificando...' : 'Iniciar sesión'}
              </button>
              <p className="ch-status" role="status">
                {isRedirecting ? 'Abriendo tu panel…' : ''}
              </p>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
