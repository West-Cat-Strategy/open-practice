FROM node:26.3.0-alpine3.23@sha256:144769ec3f32e8ee36b3cfde91e82bee25d9367b20f31a151f3f7eea3a2a8541 AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g npm@11.16.0 pnpm@11.4.0
RUN apk add --no-cache libc6-compat

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
ARG APP_NAME
ARG OPEN_PRACTICE_RELAXED_CSP=false
ENV OPEN_PRACTICE_RELAXED_CSP=${OPEN_PRACTICE_RELAXED_CSP}
RUN pnpm turbo build --filter=${APP_NAME}...
RUN pnpm --filter=${APP_NAME} deploy --legacy --prod /prod

FROM base AS runner
WORKDIR /app

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN chown nextjs:nodejs /app
USER nextjs

COPY --from=builder --chown=nextjs:nodejs /prod .

CMD ["pnpm", "start"]
