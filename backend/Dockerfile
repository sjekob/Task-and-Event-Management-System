FROM python:3.11-slim

WORKDIR /app

# Tesseract OCR reads photos / scanned PDFs of certificates (certificate_reader.py).
RUN apt-get update     && apt-get install -y --no-install-recommends tesseract-ocr     && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Default: run the API gateway.
# Override CMD in docker-compose to run an individual service.
EXPOSE 8000
CMD ["uvicorn", "gateway.main:app", "--host", "0.0.0.0", "--port", "8000"]
