# syntax=docker/dockerfile:1

# --- Builder: resolve deps with uv and build the venv --------------------
FROM python:3.12-slim-bookworm AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

ENV UV_COMPILE_BYTECODE=1

# Dependency manifests + sam3 workspace member first, so dependency
# installation is cached and only reruns when these actually change.
# (sam3's version is read from sam3.__version__ at build time, so its full
# source tree — not just pyproject.toml — must be present here.)
COPY pyproject.toml uv.lock ./
COPY sam3 ./sam3

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev

# Now bring in the rest of the source (app code, sam3 sources, labs/).
COPY . .

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# --- Runtime: slim image with just the venv + app code --------------------
FROM python:3.12-slim-bookworm

WORKDIR /app

# libgl1/libglib2.0-0: required by opencv-python-headless at import time.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/app ./app
COPY --from=builder /app/labs ./labs
COPY --from=builder /app/main.py ./main.py

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PORT=8000

# Runtime data (videos, db, results) and model weights are gitignored and
# expected to be bind-mounted in; see docker-compose.yml.
RUN mkdir -p /app/data /app/ai-model

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
