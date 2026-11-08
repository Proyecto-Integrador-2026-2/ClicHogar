import { t } from 'elysia';

/**
 * Cuerpos de registro y login. Solo fijan la forma (strings); las reglas de
 * negocio (correo válido, longitud de contraseña) viven en `auth.service`
 * para dar mensajes claros.
 */
export const RegistroDto = t.Object({
  nombre: t.Optional(t.String()),
  email: t.String(),
  password: t.String(),
  rol: t.Optional(t.String()),
});

export const LoginDto = t.Object({
  email: t.String(),
  password: t.String(),
});

export const OlvideContrasenaDto = t.Object({
  email: t.String(),
});

export const RestablecerContrasenaDto = t.Object({
  token: t.String(),
  password: t.String(),
});
