# syntax=docker/dockerfile:1.7

FROM golang:1.26.4-alpine3.23@sha256:f23e8b227fb4493eabe03bede4d5a32d04092da71962f1fb79b5f7d1e6c2a17f AS builder

ARG MAILPIT_VERSION=v1.30.3
ARG MAILPIT_SHA256=1e6a94e92b5e6ebbdaed7ec2dd280b7d200185697d723044c5a9fc239fcdb6d8

WORKDIR /src

RUN --mount=type=cache,id=open-practice-mailpit-go-build,target=/root/.cache/go-build \
  --mount=type=cache,id=open-practice-mailpit-go-mod,target=/go/pkg/mod \
  --mount=type=cache,id=open-practice-mailpit-npm,target=/root/.npm \
  apk add --no-cache npm \
  && wget -O mailpit.tar.gz "https://github.com/axllent/mailpit/archive/refs/tags/${MAILPIT_VERSION}.tar.gz" \
  && echo "${MAILPIT_SHA256}  mailpit.tar.gz" | sha256sum -c - \
  && tar -xzf mailpit.tar.gz --strip-components=1 \
  && rm mailpit.tar.gz \
  && npm ci --cache /root/.npm \
  && npm run package \
  && CGO_ENABLED=0 go build -ldflags "-s -w -X github.com/axllent/mailpit/config.Version=${MAILPIT_VERSION}" -o /mailpit

FROM alpine:3.23.4@sha256:5b10f432ef3da1b8d4c7eb6c487f2f5a8f096bc91145e68878dd4a5019afde11

LABEL org.opencontainers.image.title="Mailpit" \
  org.opencontainers.image.description="An email and SMTP testing tool with API for developers" \
  org.opencontainers.image.source="https://github.com/axllent/mailpit" \
  org.opencontainers.image.url="https://mailpit.axllent.org" \
  org.opencontainers.image.documentation="https://mailpit.axllent.org/docs/" \
  org.opencontainers.image.version="v1.30.3" \
  org.opencontainers.image.revision="8b4afc808a3a6451a6ff7031f935c63a6d197d20" \
  org.opencontainers.image.licenses="MIT"

COPY --from=builder /mailpit /mailpit

RUN apk add --no-cache tzdata \
  && apk upgrade --no-cache libcrypto3 libssl3 \
  && addgroup -S mailpit \
  && adduser -S -D -H -u 10001 -G mailpit mailpit

WORKDIR /tmp
USER mailpit

EXPOSE 1025/tcp 1110/tcp 8025/tcp

HEALTHCHECK --interval=15s --start-period=10s CMD ["/mailpit", "readyz"]

ENTRYPOINT ["/mailpit"]
