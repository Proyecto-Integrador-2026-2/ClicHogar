import { t } from 'elysia';

/**
 * Body del endpoint de sincronización Clerk -> Postgres (US-001).
 * La identidad (clerkId/email) viene del session token verificado, NO del
 * body: el cliente solo envía los datos de perfil que Clerk no guarda.
 * Acepta tanto los valores del backend ('cliente'/'afiliado') como los
 * del frontend ('Usuario'/'Afiliado'); el service los normaliza.
 */
export const SincronizarUsuarioDto = t.Object({
  nombre: t.Optional(
    t.String({
      minLength: 2,
      maxLength: 120,
      error: 'El nombre debe tener entre 2 y 120 caracteres.',
    })
  ),
  rol: t.Optional(
    t.Union(
      [
        t.Literal('cliente'),
        t.Literal('afiliado'),
        t.Literal('Usuario'),
        t.Literal('Afiliado'),
      ],
      { error: "El rol debe ser 'cliente'/'Usuario' o 'afiliado'/'Afiliado'." }
    )
  ),
});

export type SincronizarUsuarioInput = typeof SincronizarUsuarioDto.static;
