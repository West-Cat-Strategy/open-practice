FROM postgres:17-alpine@sha256:d5daad18926b71c3d663f358af0aea798670cb79fb550c106d19662a9d1627ef AS upstream

RUN apk add --no-cache su-exec \
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
ENV PG_MAJOR=17
ENV PG_VERSION=17.10
ENV PG_SHA256=078a03516dcdbdb705fecaf415ea3d13a956c589e46f09fed68a06fb00598c90
ENV DOCKER_PG_LLVM_DEPS="llvm19-dev \t\tclang19"
ENV PGDATA=/var/lib/postgresql/data

VOLUME /var/lib/postgresql/data

STOPSIGNAL SIGINT

EXPOSE 5432

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["postgres"]
