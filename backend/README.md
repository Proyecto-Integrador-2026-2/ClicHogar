# ClicHogar · Backend

API del prototipo ClicHogar (Elysia + Bun + PostgreSQL sin ORM, SQL nativo
parametrizado). Autenticación delegada a Clerk: el backend verifica session
tokens, nunca guarda passwords de usuarios Clerk.

## Requisitos

- [Bun](https://bun.sh) ≥ 1.4
- PostgreSQL ≥ 14 con la base creada (p. ej. `clichogar`)

## Configuración

```bash
bun install
cp .env.example .env   # y completa DATABASE_URL + CLERK_SECRET_KEY
bun run db:migrate      # aplica drizzle/*.sql
```

## Comandos

| Comando               | Qué hace                              |
| --------------------- | ------------------------------------- |
| `bun run dev`         | Servidor con recarga (`index.ts`)     |
| `bun run start`       | Servidor sin recarga                  |
| `bun run test`        | Suite `bun test` (pura, sin BD)       |
| `bun run typecheck`   | `tsc --noEmit` (tipos estrictos)      |
| `bun run lint`        | ESLint (reglas TS recomendadas)       |
| `bun run db:generate` | Genera migración desde `db/schema.ts` |
| `bun run db:migrate`  | Aplica migraciones pendientes         |
| `bun run db:studio`   | Inspector visual de Drizzle           |

## Estructura

```text
backend/
├── index.ts            # punto de entrada (escucha en env.PORT)
├── app.ts              # buildApp(): arma Elysia sin arrancar (testeable)
├── config/env.ts       # validación fail-fast de variables de entorno
├── db/
│   ├── client.ts       # pool SQL nativo de Bun
│   ├── schema.ts       # índice de schemas (solo drizzle-kit, no runtime)
│   └── schema/         # definición de tablas por módulo (migraciones)
├── drizzle/            # migraciones SQL generadas (versionadas en git)
├── modules/usuarios/   # módulo vertical: controllers/ dto/ entities/
│                       # mappers/ repositories/ services/
└── shared/             # auth/ errors/ security/ (transversal, sin estado)
```

## Convenciones

- Los `services` nunca escriben SQL: pasan por `repositories`.
- Los `controllers` nunca devuelven entidades crudas: usan `mappers`
  (`toUsuarioPublico`: jamás expone `passwordHash`).
- La identidad del usuario sale del token Clerk verificado, nunca del body.
- `shared/` no importa de `modules/` (la dependencia va en un sentido).
