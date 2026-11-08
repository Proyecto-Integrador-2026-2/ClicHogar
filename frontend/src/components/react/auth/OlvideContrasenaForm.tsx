/**
 * "Olvidé mi contraseña": pide el correo y, sin revelar si existe una cuenta,
 * avisa que se envió un enlace para restablecerla. El enlace llega a
 * `/restablecer-contrasena?token=…` (ver `RestablecerContrasenaForm`).
 */
import React, { useRef, useState } from 'react';
import { solicitarRecuperacion } from '../../../lib/usuarios-api';
import './auth.css';
import { TextField } from './fields';
import { sanearEmail } from './login.validation';
import {
  IDS_RECUPERACION,
  validarCorreoRecuperacion,
} from './recuperacion.validation';

export default function OlvideContrasenaForm() {
  const [email, setEmail] = useState('');
  const [tocado, setTocado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  // Guarda síncrona contra doble clic: el estado llega tarde.
  const enCurso = useRef(false);

  const errorCorreo = tocado ? validarCorreoRecuperacion(email) : undefined;

  const enviar = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (enCurso.current) return;
    setTocado(true);
    setError('');
    if (validarCorreoRecuperacion(email)) return;
    enCurso.current = true;
    setEnviando(true);
    try {
      const r = await solicitarRecuperacion(sanearEmail(email));
      setMensaje(r.mensaje);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'No se pudo enviar el enlace.'
      );
    } finally {
      enCurso.current = false;
      setEnviando(false);
    }
  };

  return (
    <div className="ch-auth">
      <div className="ch-card">
        <h2 className="ch-card__title">¿Olvidaste tu contraseña?</h2>
        <p className="ch-card__subtitle">
          Escribe tu correo y te enviaremos un enlace para elegir una nueva.
        </p>

        {error && (
          <div className="ch-alert ch-alert--error" role="alert">
            {error}
          </div>
        )}

        {mensaje ? (
          <>
            <div className="ch-alert ch-alert--exito" role="status">
              {mensaje}
            </div>
            <p className="ch-field__hint">
              El enlace vale 1 hora. Revisa también la carpeta de spam.
            </p>
            <p>
              <a href="/login">Volver a iniciar sesión</a>
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
                <TextField
                  id={IDS_RECUPERACION.email}
                  label="Correo electrónico"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  onBlur={() => setTocado(true)}
                  error={errorCorreo}
                  required
                  autoComplete="email"
                  inputMode="email"
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
                  {enviando ? 'Enviando...' : 'Enviar enlace'}
                </button>
                <p>
                  <a href="/login">Volver a iniciar sesión</a>
                </p>
              </div>
            </fieldset>
          </form>
        )}
      </div>
    </div>
  );
}
