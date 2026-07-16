# Use a standard python slim base image
FROM python:3.13-slim-bookworm AS builder

WORKDIR /app

# Install compiler and compilation tools for building packages like numpy
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install --no-cache-dir uv

# Enable bytecode compilation
ENV UV_COMPILE_BYTECODE=1

# Copy dependency definition files and workspace members
COPY pyproject.toml uv.lock ./
COPY sam3 ./sam3

# Install dependencies without installing the project itself (for cache optimization)
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev

# Copy the application source code
COPY . .

# Sync the project including the code
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# Use a clean, minimal runtime python image
FROM python:3.13-slim-bookworm

WORKDIR /app

# Copy the synchronized virtual environment and source code
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app /app

# Set environment variables to run using the virtual environment python
ENV PATH="/app/.venv/bin:$PATH"
ENV PORT=8000
ENV SQLITE_DB_PATH="/app/data/smart_gate.db"
ENV PYTHONUNBUFFERED=1

# Create volume mount points with correct permissions
RUN mkdir -p /app/data /app/data/evidence

EXPOSE 8000

# Run the FastAPI app
CMD ["python", "-m", "backend.app"]
