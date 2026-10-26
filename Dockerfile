FROM node:24.22.1-bookworm-slim AS base

# Prisma 6 usa el query engine nativo, que necesita openssl.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.34.3 --activate
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm exec prisma generate
RUN pnpm run build

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=4000
# node_modules completo: el arranque corre `prisma migrate deploy` y el CLI es devDependency.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node package.json ./package.json
# Los adjuntos viven en un volumen montado en /app/uploads; al crearse vacío copia estas carpetas.
RUN mkdir -p uploads/avatars uploads/license-templates uploads/license-generated && chown -R node:node uploads
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
# Aplica las migraciones pendientes y arranca. El seed ya no corre en cada arranque: pisaba el
# password del admin con ADMIN_PASSWORD y las reglas de licencias editadas desde la app.
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/src/main.js"]
