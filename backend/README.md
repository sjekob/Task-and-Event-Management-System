# TaskNet backend (FastAPI + PostgreSQL)

## Run

Everything (PostgreSQL, the five services and the gateway on :8000):

```powershell
copy ..\.env.example ..\.env    # then set JWT_SECRET_KEY
docker compose up --build       # from the project root
```

Without Docker for the services (PostgreSQL still runs in Docker unless
`DATABASE_URL` points elsewhere): `..\start.ps1` (microservices) or
`..\start.bat` (single app, `main.py`).

API docs: http://localhost:8000/docs

## Database

- `database.py` holds the schema and the connection layer. Every service runs
  `init_db()` at startup. It creates any missing tables. On an empty database
  it also adds the demo accounts and sample data.
- Set the connection with `DATABASE_URL`. The default is
  `postgresql://tasknet:tasknet@localhost:5432/tasknet`.
- Routes write SQL with `?` placeholders. The connection layer converts them
  for psycopg2 and returns rows you can read by column name or by position.

### Moving an existing SQLite database to PostgreSQL

```powershell
$env:DATABASE_URL = "postgresql://tasknet:tasknet@localhost:5432/tasknet"
python tools/sqlite_to_postgres.py tasknet.db
```

The script creates the schema, clears it, and copies every row with its
original id. Run it once, before the services start writing to PostgreSQL.

## Default accounts (fresh database)

| Username     | Password | Role        |
|--------------|----------|-------------|
| admin        | admin123 | Admin       |
| principal    | prin123  | Principal   |
| coordinator1 | coord123 | Coordinator |
| dean1        | dean123  | Dean        |
| teacher1     | teach123 | Teacher     |
| registrar    | reg123   | Registrar   |
