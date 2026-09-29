import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../shared/errors/app-error';
import type { RolUsuario } from '../entities/usuario.entity';
import { usuariosRepository } from '../repositories/usuarios.repository';
import {
  disponibilidadRepository,
  type SlotDisponibilidad,
} from '../repositories/disponibilidad.repository';

/** Franjas válidas (vocabulario fijo, ASCII para filtros futuros). */
export const FRANJAS_VALIDAS = ['manana', 'tarde', 'noche'] as const;

export type Franja = (typeof FRANJAS_VALIDAS)[number];

const ORDEN_FRANJA: Record<string, number> = {
  manana: 0,
  tarde: 1,
  noche: 2,
};

/**
 * Normaliza la matriz recibida: valida día (0-6) y franja, deduplica y
 * ordena. Pura y unit-testeable. Arreglo vacío = limpiar (#103, Esc 3).
 */
export function normalizarSlots(entrada: unknown): SlotDisponibilidad[] {
  if (!Array.isArray(entrada)) {
    throw new ValidationError('Los horarios deben ser un arreglo.');
  }
  const vistos = new Set<string>();
  const salida: SlotDisponibilidad[] = [];
  for (const item of entrada) {
    if (typeof item !== 'object' || item === null) {
      throw new ValidationError('Cada horario debe tener día y franja.');
    }
    const { dia, franja } = item as { dia?: unknown; franja?: unknown };
    if (
      typeof dia !== 'number' ||
      !Number.isInteger(dia) ||
      dia < 0 ||
      dia > 6
    ) {
      throw new ValidationError('El día debe ser un entero entre 0 y 6.');
    }
    if (
      typeof franja !== 'string' ||
      !FRANJAS_VALIDAS.includes(franja as Franja)
    ) {
      throw new ValidationError('La franja debe ser manana, tarde o noche.');
    }
    const clave = `${dia}:${franja}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    salida.push({ diaSemana: dia, franjaHoraria: franja });
  }
  salida.sort(
    (a, b) =>
      a.diaSemana - b.diaSemana ||
      (ORDEN_FRANJA[a.franjaHoraria] ?? 0) -
        (ORDEN_FRANJA[b.franjaHoraria] ?? 0)
  );
  return salida;
}

/**
 * Guardia de rol (#102, Escenario 4): solo afiliados configuran
 * disponibilidad. Pura y unit-testeable; el service la aplica con el
 * rol real leído de Postgres (nunca del body).
 */
export function verificarRolAfiliado(rol: RolUsuario): void {
  if (rol !== 'afiliado') {
    throw new ForbiddenError(
      'Esta sección es exclusiva para perfiles de Afiliados.'
    );
  }
}

export const disponibilidadService = {
  /**
   * Guarda (reemplaza) la matriz del afiliado autenticado.
   * 404 sin perfil local; 403 sin rol afiliado; 400 con slots inválidos.
   */
  async guardar(
    clerkId: string,
    slotsCrudos: unknown
  ): Promise<SlotDisponibilidad[]> {
    const usuario = await usuariosRepository.buscarPorClerkId(clerkId);
    if (!usuario) {
      throw new NotFoundError(
        'Aún no tienes perfil local. Llama a POST /api/usuarios/sync primero.'
      );
    }
    verificarRolAfiliado(usuario.rol);
    const slots = normalizarSlots(slotsCrudos);
    return disponibilidadRepository.reemplazar(usuario.id, slots);
  },

  /** Lee la matriz actual (prefill del formulario y vista pública). */
  async obtener(clerkId: string): Promise<SlotDisponibilidad[]> {
    const usuario = await usuariosRepository.buscarPorClerkId(clerkId);
    if (!usuario) {
      throw new NotFoundError(
        'Aún no tienes perfil local. Llama a POST /api/usuarios/sync primero.'
      );
    }
    return disponibilidadRepository.listarPorUsuarioId(usuario.id);
  },
};
