FROM postgres:17-alpine@sha256:c7526c0f6c3f30260a563d7bcf8ad778effac59a44f8ffa86678c35418338609 AS upstream

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
ENV PG_VERSION=17.9
ENV PG_SHA256=3b9a62538a8da151e807a3ddb1198e8605f2032544d78f403ae883d27ecf1ee4
ENV DOCKER_PG_LLVM_DEPS="llvm19-dev \t\tclang19"
ENV PGDATA=/var/lib/postgresql/data

VOLUME /var/lib/postgresql/data

STOPSIGNAL SIGINT

EXPOSE 5432

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["postgres"]
