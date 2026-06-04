FROM node:26.2.0-alpine3.23@sha256:7c6af15abe4e3de859690e7db171d0d711bf37d27528eddfe625b2fe89e097f8 AS base
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
