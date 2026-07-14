# MatchQuill Backend — production image (Railway / any container host)
# Multi-stage build. Runtime stage carries the native libraries WeasyPrint needs.

# ---------------------------------------------------------------------------
# Builder: install Python deps (needs -dev headers to compile wheels)
# ---------------------------------------------------------------------------
FROM python:3.11-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libffi-dev \
    libcairo2-dev \
    libpango1.0-dev \
    libgdk-pixbuf-2.0-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# ---------------------------------------------------------------------------
# Runtime: only the shared libraries WeasyPrint loads at runtime
# ---------------------------------------------------------------------------
FROM python:3.11-slim

WORKDIR /app

# WeasyPrint runtime deps. libpangoft2 + libharfbuzz-subset0 are required by
# recent WeasyPrint; libglib2.0-0 provides gobject-2.0 — without it WeasyPrint
# fails at runtime with "cannot load library 'gobject-2.0-0'".
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libpangoft2-1.0-0 \
    libharfbuzz-subset0 \
    libgdk-pixbuf-2.0-0 \
    libglib2.0-0 \
    libffi8 \
    fonts-liberation \
    shared-mime-info \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Ensure the dynamic loader can find the libs (prevents find_library() misses
# seen specifically on Railway).
ENV LD_LIBRARY_PATH=/usr/lib:/usr/local/lib:/usr/lib/x86_64-linux-gnu

# Copy installed Python packages + app from the builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --from=builder /app /app

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Railway injects PORT at runtime (8080). Locally we default to 8000.
EXPOSE 8000

# Health endpoint lives under the API prefix (/api/py/health). Shell form so
# ${PORT} expands at runtime.
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl --fail "http://127.0.0.1:${PORT:-8000}/api/py/health" || exit 1

# Shell form is REQUIRED so ${PORT} expands. Exec form would pass the literal
# string "$PORT" to uvicorn and the container would be unreachable on Railway.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
