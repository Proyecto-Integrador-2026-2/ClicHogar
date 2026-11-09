import type { Categoria } from '../../tareas/categorias';

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

/**
 * Tarea resumida que acompaña a una oferta en "Mis ofertas": lo justo para
 * identificarla y enlazar a su detalle, sin coordenadas ni datos privados.
 */
export type TareaResumenOferta = {
  id: string;
  titulo: string;
  descripcion: string;
  categoria: Categoria;
  estado: string;
  ubicacion: string;
  creadoEn: Date;
  /** Autor de la tarea (el cliente, cuando la ve un afiliado). */
  autorId: string;
  autorNombre: string;
};

/** Tarea que el afiliado tiene aceptada, con la oferta que le fue aceptada. */
export type OfertaAceptada = {
  tarea: TareaResumenOferta;
  oferta: Oferta;
};

/** Tarea publicada por el usuario, con todas las ofertas que ha recibido. */
export type TareaConOfertas = {
  tarea: TareaResumenOferta;
  ofertas: OfertaRecibida[];
};

/**
 * Respuesta de `GET /api/ofertas/mias`, agrupada para la página de ofertas:
 * - `aceptadas`: tareas activas donde el usuario es el afiliado elegido.
 * - `creadas`: tareas publicadas por el usuario con sus ofertas recibidas.
 */
export type MisOfertas = {
  aceptadas: OfertaAceptada[];
  creadas: TareaConOfertas[];
};
