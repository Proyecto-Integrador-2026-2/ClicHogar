/**
 * Carga y valida las variables de entorno requeridas por el backend.
 * Bun carga automáticamente el archivo .env, no se necesita dotenv.
 */

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `Falta la variable de entorno obligatoria "${name}". Revisa tu archivo .env (usa .env.example como guía).`
    );
  }
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT ?? 3000),
  DATABASE_URL: requireEnv('DATABASE_URL'),
  // Origen permitido en producción (p. ej. https://clichogar.vercel.app).
  // En desarrollo se acepta cualquier http://localhost:<puerto>.
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? '',
  // Frontend al que apuntan los enlaces de los correos (recuperación de
  // contraseña). Sin configurar: Vercel en producción, Astro en local.
  FRONTEND_URL: (
    process.env.FRONTEND_URL ??
    (process.env.NODE_ENV === 'production'
      ? 'https://clichogar.vercel.app'
      : 'http://localhost:4321')
  ).replace(/\/$/, ''),
  // Envío de correo con Resend (https://resend.com). Sin RESEND_API_KEY el
  // correo no se envía: el mensaje queda en la consola del servidor.
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? '',
  MAIL_FROM: process.env.MAIL_FROM ?? 'ClicHogar <onboarding@resend.dev>',
  SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME ?? 'clichogar_session',
  // Duración de la sesión en segundos (por defecto 7 días).
  SESSION_TTL_SECONDS: Number(
    process.env.SESSION_TTL_SECONDS ?? 60 * 60 * 24 * 7
  ),
} as const;

export const isProduction = env.NODE_ENV === 'production';
