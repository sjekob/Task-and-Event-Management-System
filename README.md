
# Task and Event Management System

## Project Description
The administrative operations at Naga Central School II currently face challenges with fragmented, paper-based processes and inefficient digital tool usage. This system addresses these issues by centralizing procedures into a single, dependable digital platform to eliminate miscommunication and document loss.

## Core Modules
* **Task Management:** Real-time assignment and tracking with centralized document organization.
* **Personnel Appraisal:** Performance monitoring and event-based evaluations.
* **Event Management:** Approval workflows, built-in document editing, and committee task automation.
* **Personnel Management:** Staff records, secure authentication (RBAC), and delegation management.

## Tech Stack
* **Frontend:** Flutter (Dart)
* **Backend:** FastAPI (Python)
* **Database:** PostgreSQL

### Installation Guide
1. **Clone the repository:**
   `git clone https://github.com/sjekob/Task-and-Event-Management-System.git`

2. **Backend Setup:**
   - `cd backend`
   - `pip install -r requirements.txt`
   - `uvicorn main:app --reload`

3. **Frontend Setup:**
   - `cd frontend`
   - `flutter pub get`
   - `flutter run`

## Contributors
* **Marc Jacob Cariño** - Project Lead 
* **Dhenz Mark Alden**
* **Louis Neo Lok**
*  **John Michael Mamiit**
=======
# TaskNet — Full Monorepo
**School Management & Task Delegation System**
Naga Central School II

---

## Structure

```
TaskNet-Workspace/
├── backend-fastapi/       FastAPI REST API + PostgreSQL
└── frontend-flutter/      Flutter app (Web, Android, iOS, Desktop)
```

---

## Start Everything (Docker — Recommended)

```bash
# From this root folder:
docker compose up --build
```

| Service        | URL                          |
|----------------|------------------------------|
| API            | http://localhost:8000        |
| Swagger UI     | http://localhost:8000/docs   |
| pgAdmin        | http://localhost:5050        |
| Flutter Web    | Run separately — see below   |

---

## Run Flutter

```bash
cd frontend-flutter
flutter pub get
flutter run -d chrome          # Web
flutter run                    # Mobile (emulator/device)
```

---

## Full Setup Guide

See `backend-fastapi/README.md` and `frontend-flutter/README.md` for detailed instructions.
>>>>>>> af2ae7a (Initial setup of TaskNet Workspace: Backend FastAPI and Frontend Flutter)
