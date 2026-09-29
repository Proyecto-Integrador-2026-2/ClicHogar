/**
 * Reglas de validación del formulario de perfil (US-004).
 * Todo opcional (Escenario 2: lo ausente no se envía ni se toca):
 * la foto se valida por tipo real y peso (Esc 3-4), la descripción se
 * acota a 500 con contador visual (Esc 5) y la ubicación es texto libre.
 */

export type ValoresPerfil = {
  foto: File | null;
  descripcion: string;
  ubicacion: string;
};

/** Claves con error visible. */
export type ClaveErrorPerfil = 'foto' | 'descripcion' | 'ubicacion';

/** Ids de ancla del formulario (prefijo ch- para no colisionar). */
export const IDS_PERFIL = {
  foto: 'ch-perfil-foto',
  descripcion: 'ch-perfil-descripcion',
  ubicacion: 'ch-perfil-ubicacion',
} as const;

/** Etiquetas legibles para el resumen de errores. */
export const ETIQUETAS_PERFIL: Record<ClaveErrorPerfil, string> = {
  foto: 'Foto de perfil',
  descripcion: 'Descripción',
  ubicacion: 'Ubicación aproximada',
};

/** 5 MB: mismo límite que el servidor (Escenarios 3 y 4). */
export const MAX_FOTO_BYTES = 5 * 1024 * 1024;

/** 500 caracteres de descripción (Escenario 5). */
export const MAX_DESCRIPCION = 500;

const TIPOS_FOTO = ['image/jpeg', 'image/png'];

/**
 * Valida el archivo elegido sin subirlo: extensión/MIME declarado y peso.
 * La verificación definitiva (número mágico) la hace el servidor (#96).
 * Null = sin foto, siempre válido porque es opcional.
 */
export function validarFoto(archivo: File | null): string | undefined {
  if (!archivo) return undefined;
  const extension = archivo.name.split('.').pop()?.toLowerCase() ?? '';
  const tipoOk =
    TIPOS_FOTO.includes(archivo.type) ||
    extension === 'jpg' ||
    extension === 'jpeg' ||
    extension === 'png';
  if (!tipoOk) {
    return 'La foto debe ser JPG o PNG.';
  }
  if (archivo.size > MAX_FOTO_BYTES) {
    return 'La foto no puede superar 5MB.';
  }
  return undefined;
}

/** Valida un campo de texto (opcionales: solo acotan lo presente). */
export function validarCampoPerfil(
  campo: ClaveErrorPerfil,
  v: ValoresPerfil
): string | undefined {
  switch (campo) {
    case 'foto':
      return validarFoto(v.foto);
    case 'descripcion':
      return undefined;
    case 'ubicacion':
      return undefined;
  }
}

/** Campos evaluados en cada validación (orden de presentación). */
export const CAMPOS_PERFIL: Array<ClaveErrorPerfil> = [
  'foto',
  'descripcion',
  'ubicacion',
];
