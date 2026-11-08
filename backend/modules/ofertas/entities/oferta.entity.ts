/**
 * Oferta (postulación) de un afiliado a una tarea (US-011), tal como la
 * devuelve el API. El `afiliadoId` sale de la sesión, nunca del body.
 */
export type Oferta = {
  id: string;
  tareaId: string;
  afiliadoId: string;
  /** Propuesta de valor opcional, visible para el creador de la tarea. */
  mensaje: string | null;
  estado: string;
  creadoEn: Date;
};

/** Resultado de intentar registrar una oferta de forma atómica. */
export type ResultadoOferta =
  | { tipo: 'creada'; oferta: Oferta }
  | { tipo: 'duplicada' }
  | { tipo: 'no-abierta' };
