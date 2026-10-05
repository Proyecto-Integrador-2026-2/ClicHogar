/**
 * Lógica pura del panel principal (dashboard): resumen del perfil y
 * conteo de tareas abiertas. Sin Clerk ni red: recibe los datos que ya
 * trajo la isla y devuelve lo que se pinta. Cubierta por
 * `dashboard.stats.test.ts`.
 */
import type { TareaTablero, UsuarioPublico } from '../../../lib/usuarios-api';

export type ResumenPerfil = {
  completados: number;
  total: number;
  /** 0–100, redondeado. */
  porcentaje: number;
  /** Etiquetas de lo que falta (vacío si está completo). */
  pendientes: string[];
};

/** Foto + descripción + ubicación: lo que ve la comunidad (US-004). */
export function resumenPerfil(perfil: UsuarioPublico): ResumenPerfil {
  const campos: Array<{ etiqueta: string; lleno: boolean }> = [
    {
      etiqueta: 'Foto',
      lleno: perfil.fotoUrl !== null && perfil.fotoUrl !== '',
    },
    {
      etiqueta: 'Descripción',
      lleno: (perfil.descripcion ?? '').trim() !== '',
    },
    {
      etiqueta: 'Ubicación',
      lleno: (perfil.ubicacion ?? '').trim() !== '',
    },
  ];
  const completados = campos.filter((c) => c.lleno).length;
  const total = campos.length;
  return {
    completados,
    total,
    porcentaje: Math.round((completados / total) * 100),
    pendientes: campos.filter((c) => !c.lleno).map((c) => c.etiqueta),
  };
}

/** Solo cuentan las abiertas: es lo que el tablero lista (US-008). */
export function contarAbiertas(tareas: TareaTablero[]): number {
  return tareas.filter((t) => t.estado === 'abierta').length;
}

/** Etiqueta pública del rol guardado en el backend. */
export function etiquetaRol(rol: UsuarioPublico['rol']): string {
  return rol === 'afiliado' ? 'Clic-Worker' : 'Cliente';
}
