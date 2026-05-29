FROM postgres:18-alpine@sha256:96d56f7f57c6aacd1fcb908bc83b345ec5f83231ee486dd66a1baadce274db88 AS upstream

RUN apk add --no-cache "libcurl>=8.19.0-r0" su-exec \
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

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["postgres"]
