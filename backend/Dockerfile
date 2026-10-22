# AEGIS-X API server. Build from the repo root so the data folder is included:
#   docker build -f backend/Dockerfile -t aegis-api .
#   docker run -p 8000:8000 --env-file .env aegis-api
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000

WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install -r backend/requirements.txt

# Code and the built district data (scenario, calibration, cached sources).
COPY backend/aegis backend/aegis
COPY data data

RUN useradd --create-home aegis && mkdir -p /var/data && chown -R aegis /app /var/data
USER aegis
WORKDIR /app/backend

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s \
    CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ[\"PORT\"]}/api/v1/health', timeout=4)"

# --proxy-headers so rate limits see the visitor's address behind the host's load balancer.
CMD ["sh", "-c", "uvicorn aegis.api.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
