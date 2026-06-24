FROM postgres:18-alpine@sha256:1b1689b20d16a014a3d195653381cf2caa75a41a92d93b255a9d6ea29fd353aa AS upstream
#checkov:skip=CKV_DOCKER_3:The official Postgres entrypoint starts as root, then drops to postgres; this wrapper replaces gosu with su-exec and validates that path.

RUN apk add --no-cache "libcurl>=8.19.0-r0" su-exec \
  && apk upgrade --no-cache libcrypto3 libssl3 \
  && rm -f /usr/local/bin/gosu \
  && sed -i 's/gosu/su-exec/g' \
    /usr/local/bin/docker-entrypoint.sh \
    /usr/local/bin/docker-ensure-initdb.sh \
    /usr/local/bin/docker-enforce-initdb.sh \
  && ! grep -R "gosu" -n \
    /usr/local/bin/docker-entrypoint.sh \
    /usr/local/bin/docker-ensure-initdb.sh \
    /usr/local/bin/docker-enforce-initdb.sh \
  && su-exec postgres true

FROM scratch

COPY --from=upstream / /

ENV PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ENV LANG=en_US.utf8
ENV PG_MAJOR=18
ENV PG_VERSION=18.4
ENV PG_SHA256=81a81ec695fb0c7901407defaa1d2f7973617154cf27ba74e3a7ab8e64436094
ENV DOCKER_PG_LLVM_DEPS="llvm19-dev \t\tclang19"
ENV PGDATA=/var/lib/postgresql/data

VOLUME /var/lib/postgresql/data

STOPSIGNAL SIGINT

EXPOSE 5432

HEALTHCHECK --interval=10s --timeout=5s --retries=5 CMD pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["postgres"]
