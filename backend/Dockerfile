FROM oven/bun:1
WORKDIR /app
# Sin globs: solo los dos manifiestos (S6470). Instalación reproducible
# y sin lifecycle scripts (S8543, S6505).
COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile --ignore-scripts
# Sin copia recursiva: solo lo que usa el runtime (S6470). Los uploads
# locales y tests quedan fuera vía .dockerignore.
COPY index.ts app.ts drizzle.config.ts ./
COPY config ./config
COPY db ./db
COPY drizzle ./drizzle
COPY modules ./modules
COPY shared ./shared
# El usuario `bun` necesita escribir las fotos de perfil (S6471).
RUN mkdir -p uploads/perfiles && chown -R bun:bun /app
ENV NODE_ENV=production
USER bun
CMD ["bun", "run", "start"]
