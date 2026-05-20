# TaskNet Flutter App

School Management & Task Delegation System for **Naga Central School II**.

## Getting Started

### Prerequisites
- Flutter SDK >= 3.0.0
- Dart SDK >= 3.0.0
- A running instance of the TaskNet FastAPI backend

### Setup

1. Install dependencies:
```bash
flutter pub get
```

2. Set your API base URL in `lib/core/api_constants.dart`:
```dart
static const String baseUrl = 'http://YOUR_SERVER_IP:8000/api/v1';
```

3. Run the app:
```bash
# Mobile (with device/emulator connected)
flutter run

# Web
flutter run -d chrome

# Desktop
flutter run -d windows   # or macos / linux
```

## Project Structure

```
lib/
├── main.dart                  # Entry point
├── core/
│   ├── api_constants.dart     # All API endpoint URLs
│   └── responsive.dart        # Breakpoint helper
├── models/
│   └── user_model.dart        # Dart data classes
├── controllers/
│   └── user_controller.dart   # HTTP ↔ FastAPI layer
└── views/
    ├── shared/
    │   └── profile_view.dart  # Profile page (all roles)
    ├── principal/
    │   └── user_manager_view.dart
    ├── registrar/             # Future screens
    ├── dean/
    └── teacher/
```

## RBAC Roles
| Role | User Manager | Add/Edit/Deactivate |
|------|-------------|-------------------|
| Principal | ✅ | ✅ |
| Registrar | ✅ | ✅ |
| Dean | ✅ (dept scope) | ❌ |
| Coordinator | ✅ (grade scope) | ❌ |
| Teacher | ❌ | ❌ |
