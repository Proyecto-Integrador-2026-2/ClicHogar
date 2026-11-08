/**
 * Perfil público de un afiliado (US-012, Escenario 2): descripción,
 * disponibilidad horaria y valoraciones de servicios previos, para que el
 * creador de la tarea decida con confianza. Se abre desde las ofertas
 * recibidas: `/perfil/publico?id=<uuid>`.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { estaFirmado, obtenerToken } from '../../../lib/auth';
import {
  ErrorSesionExpirada,
  obtenerReputacion,
  obtenerDisponibilidadDe,
  obtenerPerfilPublico,
  urlPublica,
  type ReputacionApi,
  type SlotApi,
  type UsuarioPublico,
} from '../../../lib/usuarios-api';
import './auth.css';
import {
  AlertaConReintento,
  PantallaCargando,
  PantallaSinSesion,
} from './carga-sesion';
import { DIAS, FRANJAS, claveSlot } from './disponibilidad.validation';
import Estrellas, { formatearPromedio } from './Estrellas';

export const MENSAJE_AFILIADO_NUEVO =
  'Nuevo en la plataforma. Este afiliado aún no tiene valoraciones.';
export const MENSAJE_PERFIL_NO_ENCONTRADO = 'No encontramos este perfil.';
export const MENSAJE_ERROR_PERFIL =
  'No pudimos cargar el perfil. Por favor, verifica tu conexión e intenta nuevamente';

type Datos = {
  perfil: UsuarioPublico;
  disponibilidad: SlotApi[];
  reputacion: ReputacionApi;
};

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'listo'; datos: Datos }
  | { tipo: 'no-encontrado' }
  | { tipo: 'error' };

function idDeLaUrl(): string {
  try {
    return new URLSearchParams(window.location.search).get('id') ?? '';
  } catch {
    return '';
  }
}

function fechaCorta(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  return fecha.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Matriz semanal de solo lectura. */
function Horario({ slots }: Readonly<{ slots: SlotApi[] }>) {
  if (slots.length === 0) {
    return (
      <p className="ch-field__hint">Aún no ha configurado su disponibilidad.</p>
    );
  }
  const activos = new Set(
    slots.map((s) => claveSlot(s.diaSemana, s.franjaHoraria))
  );
  return (
    <table className="ch-horario">
      <thead>
        <tr>
          <th scope="col">
            <span className="ch-sr-only">Franja</span>
          </th>
          {DIAS.map((d) => (
            <th key={d.valor} scope="col">
              {d.etiqueta}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {FRANJAS.map((f) => (
          <tr key={f.valor}>
            <th scope="row">{f.etiqueta}</th>
            {DIAS.map((d) => {
              const libre = activos.has(claveSlot(d.valor, f.valor));
              return (
                <td
                  key={d.valor}
                  className={libre ? 'ch-horario__si' : 'ch-horario__no'}
                  aria-label={`${d.etiqueta} ${f.etiqueta}: ${libre ? 'disponible' : 'no disponible'}`}
                >
                  {libre ? '✓' : ''}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function PerfilPublico() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });

  const cargar = useCallback(async () => {
    const id = idDeLaUrl();
    if (!id) {
      setEstado({ tipo: 'no-encontrado' });
      return;
    }
    setEstado({ tipo: 'cargando' });
    try {
      const token = obtenerToken();
      if (!token) throw new ErrorSesionExpirada();
      const [perfil, disponibilidad, reputacion] = await Promise.all([
        obtenerPerfilPublico(id),
        obtenerDisponibilidadDe(token, id),
        obtenerReputacion(id),
      ]);
      setEstado({
        tipo: 'listo',
        datos: { perfil, disponibilidad, reputacion },
      });
    } catch (err: unknown) {
      if (err instanceof ErrorSesionExpirada) {
        window.location.href = '/login?expirada=1';
        return;
      }
      setEstado({ tipo: 'error' });
    }
  }, []);

  useEffect(() => {
    if (estaFirmado()) void cargar();
  }, [cargar]);

  if (!estaFirmado()) {
    return (
      <PantallaSinSesion
        titulo="Perfil del afiliado"
        subtitulo="Inicia sesión para ver el perfil."
      />
    );
  }
  if (estado.tipo === 'cargando') {
    return <PantallaCargando texto="Cargando el perfil…" />;
  }
  if (estado.tipo === 'no-encontrado') {
    return (
      <div className="ch-auth">
        <div className="ch-card">
          <div className="ch-alert ch-alert--error" role="alert">
            {MENSAJE_PERFIL_NO_ENCONTRADO}
          </div>
          <a className="ch-btn ch-btn--primary" href="/tareas/mias">
            Volver a mis solicitudes
          </a>
        </div>
      </div>
    );
  }
  if (estado.tipo === 'error') {
    return (
      <div className="ch-auth">
        <div className="ch-card">
          <AlertaConReintento
            mensaje={MENSAJE_ERROR_PERFIL}
            onReintentar={() => void cargar()}
          />
        </div>
      </div>
    );
  }

  const { perfil, disponibilidad, reputacion } = estado.datos;
  return (
    <div className="ch-auth">
      <div className="ch-card ch-card--wide">
        <a className="ch-btn ch-btn--ghost" href="/tareas/mias">
          ← Volver a mis solicitudes
        </a>
        <section className="ch-autor" aria-label="Perfil">
          {perfil.fotoUrl && (
            <img
              className="ch-autor__foto"
              src={urlPublica(perfil.fotoUrl)}
              alt={`Foto de ${perfil.nombre}`}
            />
          )}
          <div>
            <h2 className="ch-card__title">{perfil.nombre}</h2>
            {reputacion.promedio === null ? (
              <p className="ch-field__hint">{MENSAJE_AFILIADO_NUEVO}</p>
            ) : (
              <p className="ch-reputacion">
                <Estrellas
                  promedio={reputacion.promedio}
                  total={reputacion.total}
                />{' '}
                <strong>
                  {formatearPromedio(reputacion.promedio)} / 5,0 estrellas
                </strong>
              </p>
            )}
            {perfil.ubicacion && (
              <p className="ch-tarea__meta">{perfil.ubicacion}</p>
            )}
          </div>
        </section>

        <h3 className="ch-autor__nombre">Sobre mí</h3>
        <p className="ch-tarea__descripcion">
          {perfil.descripcion ?? 'Aún no ha escrito una descripción.'}
        </p>

        <h3 className="ch-autor__nombre">Disponibilidad</h3>
        <Horario slots={disponibilidad} />

        {reputacion.valoraciones.length > 0 && (
          <>
            <h3 className="ch-autor__nombre">Valoraciones</h3>
            <ul className="ch-ofertas__lista">
              {reputacion.valoraciones.map((v) => (
                <li className="ch-oferta" key={v.id}>
                  <div className="ch-oferta__cuerpo">
                    <h4 className="ch-autor__nombre">{v.cliente.nombre}</h4>
                    <Estrellas promedio={v.puntuacion} total={1} />
                    {v.comentario && (
                      <p className="ch-oferta__mensaje">“{v.comentario}”</p>
                    )}
                    {fechaCorta(v.fechaServicio ?? v.fecha) && (
                      <p className="ch-tarea__meta">
                        Servicio realizado el{' '}
                        {fechaCorta(v.fechaServicio ?? v.fecha)}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
