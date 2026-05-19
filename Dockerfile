FROM node:26.0.0-alpine3.23@sha256:30f5a66e7265ef70aac56b4753ffa7905e54eca1084bc25503893ad8e9273f05 AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g npm@11.14.1 pnpm@11.1.3
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
