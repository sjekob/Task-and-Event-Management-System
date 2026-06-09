"""
seed.py — run once to populate the database with sample data.
Usage:  python -m app.seed
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base, User, SpecialTask

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./dev.db")
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Users
        if db.query(User).count() == 0:
            users = [
                User(name="Dr. Rivera",    role="Coordinator", department="Engineering"),
                User(name="Dr. Cruz",      role="Coordinator", department="Business"),
                User(name="Dr. Santos",    role="Coordinator", department="Sciences"),
                User(name="Dr. Reyes",     role="Coordinator", department="Humanities"),
                User(name="Dr. Lopez",     role="Coordinator", department="HR & Training"),
                User(name="John Smith",    role="Teacher",     department="Engineering"),
                User(name="Sarah Johnson", role="Teacher",     department="Business"),
                User(name="Mike Chen",     role="Teacher",     department="Sciences"),
                User(name="Alice Brown",   role="Teacher",     department="Humanities"),
                User(name="David Lee",     role="Teacher",     department="HR & Training"),
                User(name="Maria Santos",  role="Teacher",     department="Sciences"),
                User(name="Student A",     role="Student",     department=None),
                User(name="Student B",     role="Student",     department=None),
                User(name="Prof. Garcia",  role="Teacher",     department="Sciences"),
            ]
            db.add_all(users)
            db.commit()
            print(f"  ✓ Seeded {len(users)} users")

        # Special Tasks
        if db.query(SpecialTask).count() == 0:
            tasks = [
                SpecialTask(id="ST001", personnel="John Smith",    department="Engineering",
                            task="Curriculum Review Documentation",
                            assigned_by="Dr. Rivera", due_date="2025-04-15",
                            submitted_date="2025-04-14", status="pending",       score=None),
                SpecialTask(id="ST002", personnel="Sarah Johnson", department="Business",
                            task="Faculty Development Workshop Facilitation",
                            assigned_by="Dr. Cruz",   due_date="2025-04-10",
                            submitted_date="2025-04-11", status="evaluated",     score=67),
                SpecialTask(id="ST003", personnel="Mike Chen",     department="Sciences",
                            task="Laboratory Safety Compliance Report",
                            assigned_by="Dr. Santos", due_date="2025-04-05",
                            submitted_date="2025-04-03", status="evaluated",     score=100),
                SpecialTask(id="ST004", personnel="Alice Brown",   department="Humanities",
                            task="Research Output Documentation",
                            assigned_by="Dr. Reyes",  due_date="2025-03-30",
                            submitted_date=None,        status="flagged",        score=28),
                SpecialTask(id="ST005", personnel="John Smith",    department="Engineering",
                            task="Faculty Development Workshop Facilitation",
                            assigned_by="Dr. Rivera", due_date="2025-04-20",
                            submitted_date="2025-04-19", status="evaluated",     score=88),
                SpecialTask(id="ST006", personnel="Sarah Johnson", department="Business",
                            task="Laboratory Safety Compliance Report",
                            assigned_by="Dr. Cruz",   due_date="2025-04-25",
                            submitted_date=None,        status="notSubmitted",   score=None),
            ]
            db.add_all(tasks)
            db.commit()
            print(f"  ✓ Seeded {len(tasks)} special tasks")

        print("Seeding complete.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
