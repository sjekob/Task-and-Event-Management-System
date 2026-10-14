"""One-time import of an existing TaskNet SQLite database into PostgreSQL.

Creates the PostgreSQL schema (database.init_db, without demo data), empties
it, and copies every row of every table the two share, keeping ids. Columns
that only exist on one side are skipped. Run it once when switching a
deployment from SQLite to PostgreSQL, before the services start using it.

    # local
    DATABASE_URL=postgresql://tasknet:tasknet@localhost:5432/tasknet \
        python tools/sqlite_to_postgres.py tasknet.db

    # docker compose
    docker compose run --rm auth python tools/sqlite_to_postgres.py tasknet.db

Environment:
  DATABASE_URL   target PostgreSQL database (see database.py)
"""
import os
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import database  # noqa: E402
from date_utils import to_iso_date  # noqa: E402


def _pg_columns(db, table: str) -> dict:
    """{column: data_type} for the writable columns of a PostgreSQL table."""
    return {r["column_name"]: r["data_type"] for r in db.execute(
        "SELECT column_name, data_type FROM information_schema.columns "
        "WHERE table_schema = current_schema() AND table_name = ? "
        "AND is_generated = 'NEVER'", (table,)).fetchall()}


def _convert(value, data_type: str):
    if value is None:
        return None
    if data_type == "date":
        return to_iso_date(value)
    if data_type.startswith("timestamp"):
        return value if str(value).strip() else None
    return value


def main(sqlite_path: str):
    if not os.path.exists(sqlite_path):
        sys.exit(f"SQLite file not found: {sqlite_path}")
    lite = sqlite3.connect(f"file:{sqlite_path}?mode=ro", uri=True)

    # Schema only: init_db seeds demo data into an empty database, so create
    # the tables first and then clear everything before copying.
    database.init_db()
    db = database.connect_db()
    tables = [r["table_name"] for r in db.execute(
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'").fetchall()]
    db.execute(f"TRUNCATE {', '.join(tables)} RESTART IDENTITY CASCADE")
    # Copy in any order: skip FK checks and the append-only audit triggers.
    db.execute("SET session_replication_role = replica")

    lite_tables = {r[0] for r in lite.execute(
        "SELECT name FROM sqlite_master WHERE type='table'")}
    counts = {}
    for table in tables:
        if table not in lite_tables:
            continue
        pg_cols = _pg_columns(db, table)
        lite_cols = [r[1] for r in lite.execute(f"PRAGMA table_info({table})")]
        cols = [c for c in lite_cols if c in pg_cols]
        rows = lite.execute(f"SELECT {', '.join(cols)} FROM {table}").fetchall()
        sql = (f"INSERT INTO {table} ({', '.join(cols)}) VALUES "
               f"({', '.join('?' for _ in cols)}) ON CONFLICT DO NOTHING")
        copied = 0
        for row in rows:
            copied += db.execute(sql, [_convert(v, pg_cols[c]) for c, v in zip(cols, row)]).rowcount
        counts[table] = (copied, len(rows))

    db.execute("SET session_replication_role = DEFAULT")
    database.sync_sequences(db)
    db.commit()
    db.close()

    for table, (copied, total) in sorted(counts.items()):
        note = "" if copied == total else f"  ({total - copied} skipped as duplicates)"
        print(f"  {table:34} {copied:6}{note}")
    print(f"Imported {sum(c for c, _ in counts.values())} rows into {len(counts)} tables.")
    skipped = sorted(lite_tables - set(tables) - {"sqlite_sequence"})
    if skipped:
        print("Not imported (no PostgreSQL table): " + ", ".join(skipped))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "tasknet.db")
