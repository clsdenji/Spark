# Dockerfile for SparkParkingAPI (FastAPI + models)
FROM python:3.11-slim

# Don't write .pyc files and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# copy requirements first for better caching
COPY SparkParkingAPI/requirements.txt /app/requirements.txt

# Install build deps (scikit-learn / numpy sometimes need compilers) and pip deps
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential gcc \
    && pip install --no-cache-dir -r /app/requirements.txt \
    && apt-get remove -y build-essential gcc \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# Copy application source (models/joblib files should be in SparkParkingAPI/ so they get included)
COPY SparkParkingAPI/ /app/

# Render (and many hosts) provide PORT via env var. Default 8000 if not provided.
ENV PORT=8000
EXPOSE 8000

# Use shell form to allow env var expansion for PORT
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
