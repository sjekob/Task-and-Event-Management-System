# TaskNet — Task and Event Management System

Task, event, personnel and performance-appraisal management for a DepEd school.

## Stack

| Part | Technology | Folder |
|------|------------|--------|
| Web app | React 19 + Vite + Mantine | `web/` |
| Mobile app | React Native (Expo SDK 57, expo-router) | `mobile/` |
| Shared code | TypeScript API client, types, session, helpers | `packages/shared/` |
| Backend | FastAPI (Python) | `backend/` |
| Database | PostgreSQL 16 | Docker or your own server |

The web and mobile apps both use `@tasknet/shared`, so API calls, data types and
business rules (deadlines, points, appraisal scores, the DepEd proposal print
layout) are written once.

The old Flutter app in `frontend/` is kept only as a reference until the new apps
are signed off. It will then be removed in a separate commit.

## Run it locally

You need Node.js 20+, Python 3.11+ and Docker (for PostgreSQL).

### 1. Backend and database

```powershell
.\start.ps1        # Windows: starts PostgreSQL in Docker, the services and the gateway on :8000
```

Or run everything in Docker with `docker compose up --build`. See
[backend/README.md](backend/README.md) for the details, the demo accounts, and how to
import an existing SQLite `tasknet.db` into PostgreSQL.

API docs: http://localhost:8000/docs

### 2. Install the JavaScript workspaces (once)

```powershell
npm install
```

### 3. Web app

```powershell
npm run web        # http://localhost:5173
```

The API address comes from `web/.env` (`VITE_API_BASE`, default `http://localhost:8000`).

### 4. Mobile app

```powershell
npm run mobile     # starts Expo; scan the QR code with Expo Go, or press a / i / w
```

On a phone, `localhost` is the phone itself. Before starting, copy
`mobile/.env.example` to `mobile/.env` and set `EXPO_PUBLIC_API_BASE` to your
computer's LAN address, for example `http://192.168.1.20:8000`. See
[mobile/README.md](mobile/README.md).

### Checks

```powershell
npm run typecheck              # shared, web and mobile
npm run build:web              # production build of the web app
```

## Demo accounts (fresh database)

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Admin |
| principal | prin123 | Principal |
| coordinator1 | coord123 | Coordinator |
| teacher1 | teach123 | Teacher |
| registrar | reg123 | Registrar |
