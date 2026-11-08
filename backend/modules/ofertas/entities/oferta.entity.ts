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

/**
 * Oferta tal como la ve el creador de la tarea (US-012): con los datos
 * públicos del afiliado y su reputación (promedio de calificaciones).
 */
export type OfertaRecibida = {
  id: string;
  mensaje: string | null;
  estado: string;
  creadoEn: Date;
  afiliado: {
    id: string;
    nombre: string;
    fotoUrl: string | null;
    descripcion: string | null;
    ubicacion: string | null;
    /** Promedio de 1 a 5 (null si aún no tiene calificaciones). */
    promedio: number | null;
    totalCalificaciones: number;
  };
};

/** Resultado de intentar registrar una oferta de forma atómica. */
export type ResultadoOferta =
  | { tipo: 'creada'; oferta: Oferta }
  | { tipo: 'duplicada' }
  | { tipo: 'no-abierta' };
