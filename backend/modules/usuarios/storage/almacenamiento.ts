import { randomUUID } from 'node:crypto';

/**
 * Almacenamiento de fotos de perfil (US-004, #87-89).
 * Contrato mínimo para poder cambiar de motor sin tocar el resto:
 * hoy guarda en disco local (`backend/uploads/`), mañana puede ser
 * Cloudinary/S3 implementando esta misma interfaz.
 */

export type MimeFoto = 'image/jpeg' | 'image/png';

/** 5 MB: límite de la tarea (Escenarios 3 y 4). */
export const MAX_FOTO_BYTES = 5 * 1024 * 1024;

const EXTENSION_POR_MIME: Record<MimeFoto, 'jpg' | 'png'> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

/**
 * Detecta el tipo real por número mágico (cabecera binaria), no por la
 * extensión ni por el MIME declarado: un script renombrado a `.jpg`
 * se detecta aquí aunque el cliente mienta (#96, Escenario 3).
 */
export function detectarMimeFoto(bytes: Uint8Array): MimeFoto | undefined {
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  return undefined;
}

export type FotoGuardada = {
  /** URL pública relativa (p. ej. `/uploads/perfiles/<uuid>.jpg`). */
  url: string;
};

export interface AlmacenamientoFotos {
  guardar(datos: Uint8Array, mime: MimeFoto): Promise<FotoGuardada>;
}

/** Guarda en `backend/uploads/perfiles/` con nombre aleatorio. */
export const almacenamientoLocal: AlmacenamientoFotos = {
  async guardar(datos, mime) {
    const nombre = `${randomUUID()}.${EXTENSION_POR_MIME[mime]}`;
    await Bun.write(`uploads/perfiles/${nombre}`, datos);
    return { url: `/uploads/perfiles/${nombre}` };
  },
};
