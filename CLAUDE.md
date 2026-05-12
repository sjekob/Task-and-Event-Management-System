# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TaskNet** — A role-based task management system for an educational institution. Teachers submit task reports, deans manage their teams, and coordinators/admins oversee everything.

- **Frontend**: Flutter app (`frontend/`)
- **Backend**: Python FastAPI (`backend/`)
- **Database**: SQLite (`backend/tasknet.db`)

> The `flutter/` directory at the root is the Flutter SDK source — not application code.

## Common Commands

All frontend commands run from the `frontend/` directory.

```bash
# Run the app (web or connected device)
cd frontend && flutter run

# Run on Chrome specifically
cd frontend && flutter run -d chrome

# Build for web
cd frontend && flutter build web

# Run tests
cd frontend && flutter test

# Run a single test file
cd frontend && flutter test test/widget_test.dart

# Analyze for lint errors
cd frontend && flutter analyze

# Get/update dependencies
cd frontend && flutter pub get
```

```bash
# Start the backend (from backend/)
cd backend && python main.py
# or
cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The `start.sh` at the root launches both frontend and backend together.

## Architecture

### Frontend (`frontend/lib/`)

```
lib/
├── main.dart              # Entry point; Provider setup; splash/auto-login router
├── models/models.dart     # All data classes: User, Task, Report, Comment, DashboardData
├── services/
│   ├── api_service.dart   # All HTTP calls; base URL is hardcoded to 192.168.1.14:8000
│   └── app_state.dart     # ChangeNotifier global state; currentUser, isLoading, error
├── screens/               # One file per screen (login, dashboard, tasks, detail, activity)
│   └── main_shell.dart    # Two-pane layout wrapper (sidebar + content area)
├── widgets/
│   ├── sidebar.dart       # NavPage enum; role-gated navigation items
│   └── common_widgets.dart
└── theme/app_theme.dart   # All colors, text styles, and component themes centralized here
```

**State management**: Provider with a single `AppState` ChangeNotifier wrapping the entire app. All screens access state via `Provider.of<AppState>(context)` or `context.watch<AppState>()`.

**Navigation**: No named routes. Screens push/replace via `MaterialPageRoute`. `MainShell` manages the active `NavPage` enum internally.

**Responsive breakpoint**: 768 px — below this the sidebar collapses to a bottom nav bar.

### Roles & Permissions

| Role        | Can do |
|-------------|--------|
| Admin       | Full access — creates tasks, assigns anyone |
| Principal   | Creates tasks, assigns anyone |
| Coordinator | Creates tasks, assigns to Coordinator/Dean/Teacher (not Principal/Registrar) |
| Dean        | Creates tasks, assigns to grade-level Teachers only |
| Teacher     | Receives tasks, submits reports |
| Registrar   | Receives tasks, submits reports (cannot reassign) |

Role checks live in `AppState` (`isPrincipal`, `isCoordinator`, `isDean`, `isTeacher`, `isRegistrar`, `canAssign`) and `User` model (`isAdmin`, `isManager`, `canReviewSubmissions`, `canAssign`).

**Task visibility rule**: a task only appears in a user's tab if they are explicitly in `task_assignments` as `user_id`. Tasks are NOT visible to anyone unless assigned.

### Backend (`backend/`)

FastAPI app exposing REST endpoints under `/api/`. Key endpoints:
- `/api/auth/login`, `/api/auth/me`
- `/api/tasks` — CRUD; principal/admin only for POST
- `/api/tasks/{id}/assign` — POST (assign users), DELETE `/{uid}` (unassign)
- `/api/tasks/{id}/reports` — submit report (teacher/registrar/dean all use this)
- `/api/reports/{id}/status` — update report status (reviewer only)
- `/api/users/assignable` — returns role-filtered list of who you can assign to
- `/api/comments/` — public/private comments
- `/api/dashboard/` — summary stats
- `/api/users/`, `/api/grade-levels/`, `/api/subjects/`
- `/api/task-log/`, `/api/submission-log/`

Authentication uses Bearer tokens. The frontend stores the token in `SharedPreferences` and sends it in every request header.

### Points System

| Submission timing | Points |
|-------------------|--------|
| > 24 h early      | 100    |
| On time           | 100    |
| Late ≤ 24 h       | 50     |
| Late > 24 h       | 0      |

## Seed Accounts

Defined in `backend/database.py` → `_seed()`. The database is auto-wiped and reseeded whenever `SCHEMA_VERSION` is bumped.

| Username      | Password   | Full Name                   | Role        | Grade Level |
|---------------|------------|-----------------------------|-------------|-------------|
| `admin`       | `admin123` | System Admin                | admin       | —           |
| `principal`   | `prin123`  | Principal Liza Ramos        | principal   | —           |
| `coordinator1`| `coord123` | Coordinator Grace Tan       | coordinator | —           |
| `coordinator2`| `coord456` | Coordinator Mark Bautista   | coordinator | —           |
| `registrar`   | `reg123`   | Registrar Ana Cruz          | registrar   | —           |
| `dean1`       | `dean123`  | Dean Maria Santos           | dean        | Grade 1     |
| `dean2`       | `dean456`  | Dean Jose Reyes             | dean        | Grade 2     |
| `teacher1`    | `teach123` | Sheila P. Chevallier        | teacher     | Grade 1     |
| `teacher2`    | `teach456` | Juan D. Santos              | teacher     | Grade 1     |
| `teacher3`    | `teach789` | Maria C. Reyes              | teacher     | Grade 2     |

**Seeded assignment chain**: principal → coordinator1 (tasks 1–5), coordinator1 → dean1, dean1 → teacher1 & teacher2; principal → coordinator2 (tasks 6–7), coordinator2 → dean2, dean2 → teacher3; principal → registrar (task 1 directly).

## Key Implementation Notes

- **Hardcoded API base URL** in `api_service.dart`: `http://192.168.1.14:8000`. Change this when deploying or running on a different network.
- **Schema versioning**: `backend/database.py` has `SCHEMA_VERSION`. Bumping it deletes `tasknet.db` and reseeds on next backend start.
- Theme colors and typography are exclusively defined in `theme/app_theme.dart` — never hardcode colors inline.
- The widget test (`test/widget_test.dart`) currently references a non-existent `MyApp` class; it will fail until updated.