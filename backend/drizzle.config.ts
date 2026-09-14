import { defineConfig } from 'drizzle-kit';

// process.env.DATABASE_URL es cargado por Bun desde .env automáticamente.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    'Define DATABASE_URL en tu .env antes de generar/migrar el schema.'
  );
}

export default defineConfig({
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: databaseUrl },
  strict: true,
  verbose: true,
});
