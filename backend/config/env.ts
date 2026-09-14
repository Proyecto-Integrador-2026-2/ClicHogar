/**
 * Carga y valida las variables de entorno requeridas por el backend.
 * Bun carga automáticamente el archivo .env, no se necesita dotenv.
 */

function requireEnv(name: string): string {
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
  SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME ?? 'clichogar_session',
  // Duración de la sesión en segundos (por defecto 7 días).
  SESSION_TTL_SECONDS: Number(
    process.env.SESSION_TTL_SECONDS ?? 60 * 60 * 24 * 7
  ),
} as const;

export const isProduction = env.NODE_ENV === 'production';
