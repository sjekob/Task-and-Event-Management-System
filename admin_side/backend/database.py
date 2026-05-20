import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Dynamically locate the workspace root dev.db file to ensure we use the shared database
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATABASE_PATH = os.path.join(BACKEND_DIR, "dev.db")
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

print(f"[Admin Database] Connecting to shared database at: {DATABASE_PATH}")

engine = create_engine(
    DATABASE_URL, 
    echo=False, 
    connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
