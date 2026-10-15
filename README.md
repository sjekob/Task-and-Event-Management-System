# TaskNet — Task Management System

A full-stack task management system for educational institutions.

## Tech Stack
- **Frontend**: HTML/CSS/JS (Flutter-inspired UI)  
- **Backend**: FastAPI (Python)
- **Database**: SQLite

## Quick Start

```bash
chmod +x start.sh
./start.sh
```

Then open `frontend/index.html` in your browser.

> **Note**: The frontend connects to `http://localhost:8000` by default.  
> If deploying, update the `API` constant in `frontend/index.html`.

## Default Accounts

| Username    | Password  | Role        |
|-------------|-----------|-------------|
| admin       | admin123  | Admin       |
| coordinator | coord123  | Coordinator |
| teacher1    | teach123  | Teacher     |
| principal   | prin123   | Admin       |

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
- **Coordinator**: Create/manage tasks, view submissions
- **Teacher**: View assigned tasks, submit work

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
