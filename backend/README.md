# Backend (FastAPI)

This folder contains a minimal FastAPI scaffold for the Personnel Appraisal module.

Quick start (development):

1. Create a virtual environment and install dependencies:

```powershell
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

2. Run the server:

```powershell
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://127.0.0.1:8000` and the OpenAPI docs at `http://127.0.0.1:8000/docs`.

Notes:
- This scaffold stores evaluations in-memory for development. Replace with a real database (PostgreSQL) using `DATABASE_URL` and SQLAlchemy when ready.
- CORS is enabled for common local origins; update `ALLOWED_ORIGINS` in `app/main.py` if you need more.
