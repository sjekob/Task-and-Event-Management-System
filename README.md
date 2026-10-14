# TaskNet — Task and Event Management System

A full-stack task, event and personnel-appraisal system for educational institutions.

## Tech Stack
- **Frontend**: React Native + Expo (TypeScript, Expo Router) in `frontend/` — runs on web, Android and iOS
- **Backend**: FastAPI (Python) in `backend/` — an API gateway plus auth, personnel, tasks, events and appraisal services
- **Database**: SQLite (`backend/tasknet.db`); PostgreSQL is provisioned in Docker as the migration target

> **Note**: The original Flutter app is kept in `flutter/` for reference. The
> React Native app in `frontend/` is a screen-for-screen conversion of it.

## Quick Start

### 1. Backend (Docker — recommended)

1. Copy `.env.example` to `.env` and set `JWT_SECRET_KEY` to a long random value:
   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   ```
2. Start Docker Desktop, then from the project root:
   ```bash
   docker compose up --build -d
   ```
3. Check it is up: `docker compose ps`, then open http://localhost:8000/docs.

Stop it with `docker compose down`; read logs with `docker compose logs -f gateway`.

> **Note**: `.env` is git-ignored — every machine needs its own copy. All
> services validate login tokens with `JWT_SECRET_KEY`, so changing it signs
> everyone out.

### 1 (alternative). Backend without Docker

- Windows, all microservices + gateway: `.\start.ps1`
- Windows, single process: `start.bat`
- macOS / Linux, single process: `./start.sh`

> **Note**: The single-process backend (`backend/main.py`) does not mount the
> public QR evaluation route, so `/eval/<event id>` only works with the
> microservices (Docker or `start.ps1`).

### 2. Frontend

```bash
npm --prefix frontend install
npm --prefix frontend run web
```

Then open http://localhost:8081.

> **Note**: The frontend connects to `http://localhost:8000` (the gateway) by
> default. Port 8000 must be free — run only one backend at a time. To
> point it elsewhere, set `EXPO_PUBLIC_API_BASE` before starting it.

## Default Accounts

These accounts are seeded by `backend/database.py` the first time the backend
starts. They are for local development and demos only — change the passwords
before deploying anywhere public.

| Username     | Password | Role        | Name            |
|--------------|----------|-------------|-----------------|
| admin        | admin123 | Admin       | System Admin    |
| principal    | prin123  | Principal   | Liza Ramos      |
| coordinator1 | coord123 | Coordinator | Grace Tan       |
| coordinator2 | coord456 | Coordinator | Mark Bautista   |
| registrar    | reg123   | Registrar   | Ana Cruz        |
| dean1        | dean123  | Dean        | Maria Santos    |
| dean2        | dean456  | Dean        | Jose Reyes      |
| teacher1     | teach123 | Teacher     | Mark P. Fuentes |
| teacher2     | teach456 | Teacher     | Juan D. Santos  |
| teacher3     | teach789 | Teacher     | Maria C. Reyes  |

Accounts added later through the app (currently `jake` — Teacher, and
`dhenzmark` — Dean) use the password chosen when they were created. Passwords
are stored hashed, so they cannot be read back from the database; an admin can
reset them from the Personnel page.

## Features

### 🎯 Dashboard
- Summary stats: Pending, Submitted, Missing tasks
- Task Manager quick list
- My Tasks overview
- Pending Approval events
- Interactive calendar with task deadlines

### 📋 Task Manager (Admin/Coordinator)
- Create, edit, disable, delete tasks
- Assign tasks to multiple teachers
- View submission count per task
- Attach links, files, Google Drive, YouTube
- Context menu (⋮) for quick actions

### 📝 Task Detail (Admin/Coordinator)
- Full task description with instructions
- Points system display
- View all submissions per task
- See submitted files (PDF, links, images)
- Add public/private comments

### ✅ My Tasks (Teacher)
- View assigned tasks grouped by subject
- Filter by subject and status
- Submit files and links
- See points earned (early/on-time/late)
- Public class comments + private comments

### 🔐 RBAC
- **Admin**: Full access, manage users, all tasks
- **Principal**: Approves event proposals, manages school years, views the audit log
- **Registrar**: Reviews personnel records and certificates
- **Dean**: Oversees the teachers of a grade level
- **Coordinator**: Create/manage tasks, view submissions
- **Teacher**: View assigned tasks, submit work

> **Note**: What each role can do is decided by the backend's permission list,
> which the app reads at login; the summary above is a guide, not the rule set.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Current user |
| GET | `/api/users` | List users |
| POST | `/api/users` | Create user |
| GET | `/api/tasks` | List tasks |
| POST | `/api/tasks` | Create task |
| GET | `/api/tasks/{id}` | Task detail |
| PUT | `/api/tasks/{id}` | Update task |
| DELETE | `/api/tasks/{id}` | Delete task |
| POST | `/api/tasks/{id}/submit` | Submit task |
| POST | `/api/tasks/{id}/comments` | Add comment |
| GET | `/api/dashboard` | Dashboard data |

Full API docs: http://localhost:8000/docs

## Points System
- **Early Submission** (>24h before deadline): +100 pts
- **On Time**: +100 pts
- **Late (within 24h)**: +50 pts
- **Late (after 24h)**: 0 pts
