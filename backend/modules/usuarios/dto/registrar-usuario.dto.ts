import { t } from 'elysia';

/**
 * Contrato de entrada del endpoint de registro.
 * Elysia valida automáticamente el body contra este schema ANTES de que el
 * controller se ejecute (Validación de Servidor, HU1): si algo no cumple,
 * responde 400 sin llegar a tocar la base de datos.
 *
 * La regex de password exige al menos: 1 minúscula, 1 mayúscula, 1 número.
 */
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

export const RegistrarUsuarioDto = t.Object({
  nombre: t.String({
    minLength: 2,
    maxLength: 120,
    error: 'El nombre debe tener entre 2 y 120 caracteres.',
  }),
  email: t.String({
    format: 'email',
    maxLength: 255,
    error: 'El email no tiene un formato válido.',
  }),
  password: t.String({
    minLength: 8,
    maxLength: 72, // límite práctico de bcrypt/argon2 para el input
    pattern: PASSWORD_REGEX.source,
    error:
      'La contraseña debe tener al menos 8 caracteres, con mayúscula, minúscula y número.',
  }),
  rol: t.Optional(
    t.Union([t.Literal('cliente'), t.Literal('afiliado')], {
      error: "El rol debe ser 'cliente' o 'afiliado'.",
    })
  ),
});

export type RegistrarUsuarioInput = typeof RegistrarUsuarioDto.static;
