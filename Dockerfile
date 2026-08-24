FROM python:3.12-slim AS runtime

ARG POGEO_REF=master

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN python -m pip install --upgrade pip \
    && python -m pip install "https://github.com/vtavakkoli/PoGeo/archive/refs/heads/${POGEO_REF}.zip" \
    && useradd --create-home --uid 10001 vienna

WORKDIR /app
COPY --chown=vienna:vienna config /app/config
COPY --chown=vienna:vienna web /app/web

USER vienna
EXPOSE 8000

CMD ["uvicorn", "pogeo.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--no-access-log"]
