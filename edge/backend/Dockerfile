# Dev image for the edge backend. Runs on x86 like the rest of the dev stack;
# the real device image is Dockerfile.jetson (ARM64/JetPack), which cannot be
# built or run here.
FROM python:3.12-slim

WORKDIR /srv

RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Only what the API and local matching need. Detection extras (ultralytics,
# paddleocr) are deliberately omitted: SMART_GATE_RUN_AGENT=false in dev, so the
# image stays small and starts fast.
RUN pip install --no-cache-dir \
        "fastapi>=0.139" "uvicorn>=0.51" "requests>=2.32" "python-dotenv>=1.0" \
        "opencv-python-headless>=4.8"

COPY app ./app
COPY agent ./agent
COPY vendor ./vendor

ENV PYTHONUNBUFFERED=1 PYTHONPATH=/srv
EXPOSE 8100
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8100"]
