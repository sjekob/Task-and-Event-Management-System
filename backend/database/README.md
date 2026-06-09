# Database

This project uses SQLModel (SQLAlchemy) models in `app/models.py` and supports PostgreSQL via the `DATABASE_URL` environment variable.

Quick setup (PostgreSQL):

1. Create a PostgreSQL database and user.
2. Set `DATABASE_URL` in `.env` or your environment, e.g.: `postgresql+psycopg://user:pass@localhost:5432/personnel_appraisal`
3. Start the API — it will create tables automatically on startup.

For development you can keep the default SQLite `sqlite:///./dev.db`.
