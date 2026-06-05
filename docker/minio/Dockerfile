FROM golang:1.26.3-alpine3.23@sha256:91eda9776261207ea25fd06b5b7fed8d397dd2c0a283e77f2ab6e91bfa71079d AS builder

ARG MINIO_VERSION=RELEASE.2025-10-15T17-29-55Z
ARG MINIO_COMMIT=9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a

ENV CGO_ENABLED=0

WORKDIR /src

RUN apk add --no-cache bash ca-certificates git \
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

RUN apk add --no-cache ca-certificates tzdata

EXPOSE 9000/tcp 9001/tcp

VOLUME ["/data"]

ENTRYPOINT ["/usr/local/bin/minio"]
