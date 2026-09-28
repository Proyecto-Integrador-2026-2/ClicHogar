/**
 * Middleware global de Clerk: adjunta la sesión a cada request
 * (`Astro.locals.auth()`) y protege las rutas que lo exijan.
 * Las páginas públicas (p. ej. `/register`) no redirigen por sí solas.
 */
import { clerkMiddleware } from '@clerk/astro/server';

export const onRequest = clerkMiddleware();
