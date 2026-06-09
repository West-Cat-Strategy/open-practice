# syntax=docker/dockerfile:1.7

FROM node:26.3.0-alpine3.23@sha256:144769ec3f32e8ee36b3cfde91e82bee25d9367b20f31a151f3f7eea3a2a8541 AS runtime-base
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV TURBO_TELEMETRY_DISABLED=1

FROM runtime-base AS build-base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g npm@11.16.0 pnpm@11.4.0 \
  && pnpm config set store-dir /pnpm/store \
  && pnpm config set cache-dir /pnpm/cache \
  && pnpm config set fetch-retries 5 \
  && pnpm config set fetch-retry-maxtimeout 120000 \
  && pnpm config set fetch-timeout 300000

FROM build-base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/providers/package.json packages/providers/package.json
RUN --mount=type=cache,id=open-practice-pnpm-store,target=/pnpm/store \
  --mount=type=cache,id=open-practice-pnpm-cache,target=/pnpm/cache \
  pnpm install --frozen-lockfile --prefer-offline

FROM deps AS builder
WORKDIR /app
COPY . .
ARG APP_NAME
ARG OPEN_PRACTICE_RELAXED_CSP=false
ARG OPEN_PRACTICE_DOCKER_LOCAL_DEV=false
ARG OPEN_PRACTICE_IMAGE_PROFILE=production
ENV OPEN_PRACTICE_RELAXED_CSP=${OPEN_PRACTICE_RELAXED_CSP}
ENV OPEN_PRACTICE_DOCKER_LOCAL_DEV=${OPEN_PRACTICE_DOCKER_LOCAL_DEV}
ENV OPEN_PRACTICE_IMAGE_PROFILE=${OPEN_PRACTICE_IMAGE_PROFILE}
RUN --mount=type=cache,id=open-practice-turbo,target=/app/.turbo pnpm turbo build --filter=${APP_NAME}...
RUN --mount=type=cache,id=open-practice-pnpm-store,target=/pnpm/store \
  --mount=type=cache,id=open-practice-pnpm-cache,target=/pnpm/cache \
  pnpm --prefer-offline --filter=${APP_NAME} deploy --legacy --prod /prod

FROM runtime-base AS runner
WORKDIR /app

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN chown nextjs:nodejs /app
USER nextjs

COPY --from=builder --chown=nextjs:nodejs /prod .

CMD ["node", "-e", "console.error('Open Practice runtime images require an explicit service command.'); process.exit(1);"]
