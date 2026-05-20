# TaskNet Backend — FastAPI + PostgreSQL

School Management & Task Delegation System for **Naga Central School II**.

---

## Quick Start (Docker — Recommended)

The easiest way. Docker runs PostgreSQL and the API together automatically.

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed

### Steps

```bash
# 1. Copy the env template
cp .env.example .env

# 2. (Optional) Edit .env to change passwords or the SECRET_KEY
#    The defaults work fine for local development.

# 3. Start everything
docker compose up --build
```

That's it. Services available at:

| Service | URL |
|---------|-----|
| API | http://localhost:8000 |
| Swagger UI (interactive docs) | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |
| pgAdmin (DB browser) | http://localhost:5050 |

pgAdmin login: `admin@tasknet.local` / `admin`
Connect to server: host = `db`, port = `5432`, user = `tasknet_user`, pass = `tasknet_pass`

---

## Manual Setup (No Docker)

### Prerequisites
- Python 3.12+
- PostgreSQL 15+ running locally

### Steps

```bash
# 1. Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Create the database in PostgreSQL
psql -U postgres -c "CREATE USER tasknet_user WITH PASSWORD 'tasknet_pass';"
psql -U postgres -c "CREATE DATABASE tasknet_db OWNER tasknet_user;"

# 4. Copy and configure environment
cp .env.example .env
# Edit .env — set POSTGRES_* values to match your local PostgreSQL

# 5. Run database migrations (creates all tables + seeds grade levels & subjects)
alembic upgrade head

# 6. Start the API server
uvicorn main:app --reload
```

---

## Project Structure

```
backend-fastapi/
├── main.py                        # Entry point — mounts all routers
├── alembic.ini                    # Alembic config
├── Dockerfile                     # Container definition
├── docker-compose.yml             # PostgreSQL + API + pgAdmin
├── requirements.txt               # Python dependencies
├── .env.example                   # Environment variable template
│
├── alembic/
│   ├── env.py                     # Reads DATABASE_URL from config
│   ├── script.py.mako             # Migration file template
│   └── versions/
│       └── 001_initial_schema.py  # Creates all tables + seed data
│
├── core/
│   ├── config.py                  # Settings loaded from .env
│   ├── database.py                # SQLAlchemy engine + session factory
│   └── security.py                # JWT creation + decoding
│
├── models/
│   └── user_model.py              # SQLAlchemy ORM — User, GradeLevel, etc.
│
├── schemas/
│   └── user_schema.py             # Pydantic request/response models
│
├── services/
│   └── user_service.py            # Business logic (class-based)
│
└── controllers/
    ├── auth_controller.py         # POST /api/v1/auth/token (login)
    └── user_controller.py         # /api/v1/users/* (CRUD)
```

---

## API Endpoints

### Auth
| Method | URL | Description |
|--------|-----|-------------|
| POST | `/api/v1/auth/token` | Login — returns JWT |

### Users
| Method | URL | Access |
|--------|-----|--------|
| GET | `/api/v1/users` | Principal, Registrar, Dean, Coordinator |
| GET | `/api/v1/users/{id}` | Principal, Registrar, Dean, Coordinator |
| POST | `/api/v1/users` | Principal, Registrar |
| PATCH | `/api/v1/users/{id}` | Principal, Registrar |
| PATCH | `/api/v1/users/{id}/status` | Principal, Registrar |
| GET | `/api/v1/users/meta/grade-levels` | All authenticated |
| GET | `/api/v1/users/meta/subjects` | All authenticated |
| GET | `/api/v1/users/meta/departments` | All authenticated |

---

## Common Alembic Commands

```bash
# Apply all pending migrations
alembic upgrade head

# Roll back last migration
alembic downgrade -1

# Generate a new migration after changing models
alembic revision --autogenerate -m "describe your change"

# See migration history
alembic history
```

---

## Generating a Secure SECRET_KEY

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Paste the output into `.env` as `SECRET_KEY`.
