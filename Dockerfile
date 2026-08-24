FROM python:3.14-slim AS runtime

# Pin the geospatial core so Docker cannot silently reuse an older floating-master
# install. Bump this deliberately when ViennaGeoAI adopts a newer PoGeo revision.
ARG POGEO_REF=f3d4e02f2415182b9a85f9cf6a00be1209d047b1

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    VIENNAGEOAI_POGEO_REF=${POGEO_REF}

LABEL org.opencontainers.image.title="ViennaGeoAI" \
      org.opencontainers.image.description="Grounded geospatial AI for official City of Vienna open data" \
      org.opencontainers.image.source="https://github.com/vtavakkoli/ViennaGeoAI"

RUN python -m pip install --upgrade pip \
    && python -m pip install "https://github.com/vtavakkoli/PoGeo/archive/${POGEO_REF}.zip" \
    && printf '%s\n' "${POGEO_REF}" > /usr/local/share/viennageoai-pogeo-ref \
    && useradd --create-home --uid 10001 vienna

WORKDIR /app
COPY --chown=vienna:vienna config /app/config
COPY --chown=vienna:vienna web /app/web

USER vienna
EXPOSE 8000

CMD ["uvicorn", "pogeo.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--no-access-log"]
