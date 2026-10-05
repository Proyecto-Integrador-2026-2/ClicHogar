import { t } from 'elysia';

/**
 * Body del endpoint de actualización parcial de perfil (US-004, Esc 2).
 * Todo opcional: lo ausente no se toca. Elysia valida el archivo ANTES
 * del controller (tipo real declarado + 5 MB); el service re-verifica
 * los bytes (número mágico) por si alguien salta esta capa.
 */
export const ActualizarPerfilDto = t.Object({
  foto: t.Optional(
    t.File({
      type: ['image/jpeg', 'image/png'],
      maxSize: '5m',
      error: 'La foto debe ser JPG o PNG de máximo 5MB.',
    })
  ),
  descripcion: t.Optional(
    t.String({
      maxLength: 500,
      error: 'La descripción no puede superar 500 caracteres.',
    })
  ),
  ubicacion: t.Optional(
    t.String({
      maxLength: 120,
      error: 'La ubicación no puede superar 120 caracteres.',
    })
  ),
});

export type ActualizarPerfilInput = typeof ActualizarPerfilDto.static;
