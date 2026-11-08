/**
 * Elegir una contraseña nueva con el enlace del correo
 * (`/restablecer-contrasena?token=…`). Sin token en la URL se invita a pedir
 * un enlace nuevo. Al terminar, el enlace queda usado y las sesiones
 * abiertas se cierran: hay que iniciar sesión con la clave nueva.
 */
import React, { useRef, useState } from 'react';
import { restablecerContrasena } from '../../../lib/usuarios-api';
import './auth.css';
import { PasswordField } from './fields';
import {
  IDS_RECUPERACION,
  validarContrasenaNueva,
} from './recuperacion.validation';

export const MENSAJE_SIN_ENLACE =
  'El enlace no es válido o ya expiró. Solicita uno nuevo.';

/** Token de la URL (`?token=`), o '' si falta o no se puede leer. */
function tokenDeLaUrl(): string {
  try {
    return new URLSearchParams(window.location.search).get('token') ?? '';
  } catch {
    return '';
  }
}

export default function RestablecerContrasenaForm() {
  const [token] = useState(tokenDeLaUrl);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tocados, setTocados] = useState<Record<string, boolean>>({});
  const [intentado, setIntentado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const enCurso = useRef(false);

  const errores = validarContrasenaNueva(password, confirmPassword);
  const visible = (campo: 'password' | 'confirmPassword') =>
    tocados[campo] || intentado ? errores[campo] : undefined;
  const tocar = (campo: string) =>
    setTocados((t) => (t[campo] ? t : { ...t, [campo]: true }));

  const enviar = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (enCurso.current) return;
    setIntentado(true);
    setError('');
    if (errores.password || errores.confirmPassword) return;
    enCurso.current = true;
    setEnviando(true);
    try {
      const r = await restablecerContrasena(token, password);
      setMensaje(r.mensaje);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'No se pudo cambiar la contraseña.'
      );
    } finally {
      enCurso.current = false;
      setEnviando(false);
    }
  };

  if (!token) {
    return (
      <div className="ch-auth">
        <div className="ch-card">
          <div className="ch-alert ch-alert--error" role="alert">
            {MENSAJE_SIN_ENLACE}
          </div>
          <p>
            <a href="/olvide-contrasena">Solicitar un enlace nuevo</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ch-auth">
      <div className="ch-card">
        <h2 className="ch-card__title">Elige una contraseña nueva</h2>
        <p className="ch-card__subtitle">
          Al cambiarla se cerrarán tus sesiones abiertas.
        </p>

        {error && (
          <div className="ch-alert ch-alert--error" role="alert">
            {error} <a href="/olvide-contrasena">Solicitar un enlace nuevo</a>
          </div>
        )}

        {mensaje ? (
          <>
            <div className="ch-alert ch-alert--exito" role="status">
              {mensaje}
            </div>
            <p>
              <a href="/login">Iniciar sesión</a>
            </p>
          </>
        ) : (
          <form
            onSubmit={enviar}
            className="ch-form"
            noValidate
            aria-busy={enviando}
          >
            <fieldset disabled={enviando} className="ch-fieldset">
              <div className="ch-form">
                <PasswordField
                  id={IDS_RECUPERACION.nueva}
                  label="Contraseña nueva"
                  value={password}
                  onChange={setPassword}
                  onBlur={() => tocar('password')}
                  error={visible('password')}
                />
                <PasswordField
                  id={IDS_RECUPERACION.confirmacion}
                  label="Confirmar contraseña nueva"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  onBlur={() => tocar('confirmPassword')}
                  error={visible('confirmPassword')}
                />
                <button
                  type="submit"
                  className="ch-btn ch-btn--primary"
                  disabled={enviando}
                  aria-busy={enviando}
                >
                  {enviando && (
                    <span className="ch-spinner" aria-hidden="true" />
                  )}
                  {enviando ? 'Guardando...' : 'Cambiar contraseña'}
                </button>
              </div>
            </fieldset>
          </form>
        )}
      </div>
    </div>
  );
}
