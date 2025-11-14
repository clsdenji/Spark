# SparkParkingAPI Dockerfile (improved)
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

WORKDIR /app

# Copy requirements (path assumes build context is repo root)
COPY SparkParkingAPI/requirements.txt /app/requirements.txt

# Install build deps, upgrade pip, install python deps, then remove build deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential gcc ca-certificates \
  && python -m pip install --upgrade pip setuptools wheel \
  && pip install --no-cache-dir -r /app/requirements.txt \
  && apt-get remove -y build-essential gcc \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/* /root/.cache/pip

# Copy app code & model files (assumes SparkParkingAPI/ exists in build context)
COPY SparkParkingAPI/ /app/

EXPOSE 8000

# Start uvicorn on the PORT env var provided by Render
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]