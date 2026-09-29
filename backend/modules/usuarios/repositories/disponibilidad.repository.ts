import { sql } from '../../../db/client';

/**
 * Única capa que sabe hablar con la tabla `disponibilidad`.
 * Escritura siempre en transacción (DELETE + INSERT): o entra la matriz
 * completa o no entra nada (#105). La lectura ordena por día y franja
 * para pintar la matriz 7×3 de forma estable.
 */

export type SlotDisponibilidad = {
  diaSemana: number;
  franjaHoraria: string;
};

type SlotRow = {
  dia_semana: number;
  franja_horaria: string;
};

export const disponibilidadRepository = {
  async listarPorUsuarioId(usuarioId: string): Promise<SlotDisponibilidad[]> {
    const filas = await sql<SlotRow[]>`
      SELECT dia_semana, franja_horaria
      FROM disponibilidad
      WHERE usuario_id = ${usuarioId}
      ORDER BY dia_semana, franja_horaria
    `;
    return filas.map((f) => ({
      diaSemana: f.dia_semana,
      franjaHoraria: f.franja_horaria,
    }));
  },

  /**
   * Reemplazo total (#103): borra lo anterior e inserta lo nuevo en una
   * sola transacción. Arreglo vacío = limpiar todo (Escenario 3), también
   * transaccional.
   */
  async reemplazar(
    usuarioId: string,
    slots: SlotDisponibilidad[]
  ): Promise<SlotDisponibilidad[]> {
    await sql.begin(async (tx) => {
      await tx`DELETE FROM disponibilidad WHERE usuario_id = ${usuarioId}`;
      for (const slot of slots) {
        await tx`
          INSERT INTO disponibilidad (usuario_id, dia_semana, franja_horaria)
          VALUES (${usuarioId}, ${slot.diaSemana}, ${slot.franjaHoraria})
        `;
      }
    });
    return disponibilidadRepository.listarPorUsuarioId(usuarioId);
  },
};
