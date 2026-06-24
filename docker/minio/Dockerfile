# syntax=docker/dockerfile:1.7

FROM golang:1.26.4-alpine3.23@sha256:f23e8b227fb4493eabe03bede4d5a32d04092da71962f1fb79b5f7d1e6c2a17f AS builder

ARG MINIO_VERSION=RELEASE.2025-10-15T17-29-55Z
ARG MINIO_COMMIT=9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a

ENV CGO_ENABLED=0

WORKDIR /src

RUN --mount=type=cache,id=open-practice-minio-go-build,target=/root/.cache/go-build \
  --mount=type=cache,id=open-practice-minio-go-mod,target=/go/pkg/mod \
  apk add --no-cache bash ca-certificates git \
  && git clone --depth 1 --branch "${MINIO_VERSION}" https://github.com/minio/minio.git . \
  && test "$(git rev-parse HEAD)" = "${MINIO_COMMIT}" \
  && RELEASE_TIMESTAMP="$(printf "%s" "${MINIO_VERSION}" | sed "s/^RELEASE\\.//")" \
  && LDFLAGS="$(MINIO_RELEASE=RELEASE go run buildscripts/gen-ldflags.go "${RELEASE_TIMESTAMP}")" \
  && go build -tags kqueue -trimpath -ldflags "${LDFLAGS}" -o /minio

FROM alpine:3.23.4@sha256:5b10f432ef3da1b8d4c7eb6c487f2f5a8f096bc91145e68878dd4a5019afde11

LABEL org.opencontainers.image.title="MinIO" \
  org.opencontainers.image.description="S3-compatible object storage for local Open Practice development and testing" \
  org.opencontainers.image.source="https://github.com/minio/minio" \
  org.opencontainers.image.version="RELEASE.2025-10-15T17-29-55Z" \
  org.opencontainers.image.revision="9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a" \
  org.opencontainers.image.licenses="AGPL-3.0"

COPY --from=builder /minio /usr/local/bin/minio
COPY --from=builder /src/LICENSE /licenses/LICENSE
COPY --from=builder /src/CREDITS /licenses/CREDITS

RUN apk add --no-cache ca-certificates tzdata \
  && apk upgrade --no-cache libcrypto3 libssl3 \
  && addgroup -S minio \
  && adduser -S -D -H -u 10001 -G minio minio \
  && mkdir -p /data \
  && chown -R minio:minio /data /licenses

EXPOSE 9000/tcp 9001/tcp

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s CMD wget -q -O /dev/null http://127.0.0.1:9000/minio/health/ready || exit 1

VOLUME ["/data"]

USER minio

ENTRYPOINT ["/usr/local/bin/minio"]
