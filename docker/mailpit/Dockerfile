FROM golang:1.26.3-alpine3.23@sha256:91eda9776261207ea25fd06b5b7fed8d397dd2c0a283e77f2ab6e91bfa71079d AS builder

ARG MAILPIT_VERSION=v1.30.1
ARG MAILPIT_SHA256=bda226e88f828215fc3646258494e71ebfaf82074970ea28a319c91a64c068d2

WORKDIR /src

RUN apk add --no-cache npm \
  && wget -O mailpit.tar.gz "https://github.com/axllent/mailpit/archive/refs/tags/${MAILPIT_VERSION}.tar.gz" \
  && echo "${MAILPIT_SHA256}  mailpit.tar.gz" | sha256sum -c - \
  && tar -xzf mailpit.tar.gz --strip-components=1 \
  && rm mailpit.tar.gz \
  && npm ci \
  && npm run package \
  && CGO_ENABLED=0 go build -ldflags "-s -w -X github.com/axllent/mailpit/config.Version=${MAILPIT_VERSION}" -o /mailpit

FROM alpine:3.23.4@sha256:5b10f432ef3da1b8d4c7eb6c487f2f5a8f096bc91145e68878dd4a5019afde11

LABEL org.opencontainers.image.title="Mailpit" \
  org.opencontainers.image.description="An email and SMTP testing tool with API for developers" \
  org.opencontainers.image.source="https://github.com/axllent/mailpit" \
  org.opencontainers.image.url="https://mailpit.axllent.org" \
  org.opencontainers.image.documentation="https://mailpit.axllent.org/docs/" \
  org.opencontainers.image.licenses="MIT"

COPY --from=builder /mailpit /mailpit

RUN apk add --no-cache tzdata

EXPOSE 1025/tcp 1110/tcp 8025/tcp

HEALTHCHECK --interval=15s --start-period=10s CMD ["/mailpit", "readyz"]

ENTRYPOINT ["/mailpit"]
