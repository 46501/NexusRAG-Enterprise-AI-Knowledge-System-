FROM node:20-alpine AS frontend
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt .

RUN pip install -r requirements.txt

RUN python - <<'EOF'
from sentence_transformers import SentenceTransformer, CrossEncoder
SentenceTransformer("BAAI/bge-small-en-v1.5", device="cpu")
CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2", device="cpu")
EOF

RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --no-create-home appuser

COPY backend/ .
COPY --from=frontend /frontend/dist /app/frontend/dist

RUN chown -R appuser:appgroup /app

RUN mkdir -p /home/appuser/.cache && chown -R appuser:appgroup /home/appuser/.cache

USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
