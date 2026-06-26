# syntax=docker/dockerfile:1.7
#checkov:skip=CKV_DOCKER_2:API, web, and worker targets use service-specific Compose/runtime healthchecks; worker has no generic HTTP health endpoint.

FROM node:26.3.0-alpine3.23@sha256:144769ec3f32e8ee36b3cfde91e82bee25d9367b20f31a151f3f7eea3a2a8541 AS runtime-base
RUN apk upgrade --no-cache libcrypto3 libssl3 \
  && apk add --no-cache libc6-compat
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV TURBO_TELEMETRY_DISABLED=1

FROM runtime-base AS build-base
ARG PNPM_VERSION=11.5.3
ARG TURBO_VERSION=2.9.18
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g npm@11.16.0 pnpm@${PNPM_VERSION} turbo@${TURBO_VERSION} \
  && pnpm config set store-dir /pnpm/store \
  && pnpm config set cache-dir /pnpm/cache \
  && pnpm config set fetch-retries 5 \
  && pnpm config set fetch-retry-maxtimeout 120000 \
  && pnpm config set fetch-timeout 300000

FROM build-base AS pruner
WORKDIR /app
ARG APP_NAME
COPY . .
RUN turbo prune "${APP_NAME}" --docker

FROM build-base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN --mount=type=cache,id=open-practice-pnpm-store,target=/pnpm/store \
  --mount=type=cache,id=open-practice-pnpm-cache,target=/pnpm/cache \
  pnpm install --frozen-lockfile --prefer-offline

FROM installer AS source
WORKDIR /app
COPY tsconfig.base.json ./
COPY --from=pruner /app/out/full/ .

FROM source AS migrator
CMD ["pnpm", "--filter", "@open-practice/database", "db:migrate"]

FROM source AS builder
WORKDIR /app
ARG APP_NAME
ARG API_BASE_URL
ARG OPEN_PRACTICE_BROWSER_API_MODE=external
ARG OPEN_PRACTICE_RELAXED_CSP=false
ARG OPEN_PRACTICE_DOCKER_LOCAL_DEV=false
ARG OPEN_PRACTICE_IMAGE_PROFILE=production
ENV API_BASE_URL=${API_BASE_URL}
ENV OPEN_PRACTICE_BROWSER_API_MODE=${OPEN_PRACTICE_BROWSER_API_MODE}
ENV OPEN_PRACTICE_RELAXED_CSP=${OPEN_PRACTICE_RELAXED_CSP}
ENV OPEN_PRACTICE_DOCKER_LOCAL_DEV=${OPEN_PRACTICE_DOCKER_LOCAL_DEV}
ENV OPEN_PRACTICE_IMAGE_PROFILE=${OPEN_PRACTICE_IMAGE_PROFILE}
RUN --mount=type=cache,id=open-practice-turbo,target=/app/.turbo pnpm turbo build --filter=${APP_NAME}...

FROM builder AS app-deploy
ARG APP_NAME
RUN --mount=type=cache,id=open-practice-pnpm-store,target=/pnpm/store \
  --mount=type=cache,id=open-practice-pnpm-cache,target=/pnpm/cache \
  pnpm --prefer-offline --filter=${APP_NAME} deploy --legacy --prod /prod

FROM runtime-base AS app-runner
WORKDIR /app

# Don't run production as root
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
  && addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN chown nextjs:nodejs /app
USER nextjs

COPY --from=app-deploy --chown=nextjs:nodejs /prod .

CMD ["node", "-e", "console.error('Open Practice runtime images require an explicit service command.'); process.exit(1);"]

FROM app-runner AS api
CMD ["node", "dist/server.js"]

FROM app-runner AS worker
CMD ["node", "dist/worker.js"]

FROM app-runner AS worker-ocr
USER root
RUN apk add --no-cache ghostscript ocrmypdf poppler-utils tesseract-ocr tesseract-ocr-data-eng
USER nextjs
CMD ["node", "dist/worker.js"]

FROM runtime-base AS web
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Don't run production as root
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
  && addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN chown nextjs:nodejs /app
USER nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

CMD ["node", "apps/web/server.js"]
