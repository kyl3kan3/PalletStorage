# syntax=docker/dockerfile:1.7

# ── builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Copy workspace manifests first for a cacheable install layer.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json turbo.json ./
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
COPY packages/api/package.json packages/api/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/

RUN pnpm install --frozen-lockfile

# Copy sources and build the web app (brings in its workspace deps via turbo).
COPY . .
RUN pnpm --filter @wms/web... build

# ── runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Next.js standalone output is self-contained (server + minimal deps).
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
