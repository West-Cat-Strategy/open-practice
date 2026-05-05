FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN npm install -g npm@11.13.0
RUN apk add --no-cache libc6-compat

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
ARG APP_NAME
RUN pnpm turbo build --filter=${APP_NAME}...
RUN pnpm --filter=${APP_NAME} deploy --legacy --prod /prod

FROM base AS runner
WORKDIR /app

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

COPY --from=builder --chown=nextjs:nodejs /prod .

CMD ["pnpm", "start"]
