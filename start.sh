#!/bin/bash
# TaskNet Startup Script

echo "🚀 Starting TaskNet..."

# Install dependencies
pip install fastapi uvicorn python-multipart bcrypt python-jose[cryptography] --break-system-packages -q

# Start backend
cd "$(dirname "$0")/backend"
echo "✅ Starting FastAPI backend on http://localhost:8000"
python main.py &
BACKEND_PID=$!

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  TaskNet is running!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  📌 API:      http://localhost:8000"
echo "  📌 Docs:     http://localhost:8000/docs"
echo ""
echo "  Frontend:  npm --prefix frontend run web  (http://localhost:8081)"
echo ""
echo "  Default Accounts:"
echo "  ┌────────────────┬────────────┬─────────────┐"
echo "  │ Username       │ Password   │ Role        │"
echo "  ├────────────────┼────────────┼─────────────┤"
echo "  │ admin          │ admin123   │ Admin       │"
echo "  │ principal      │ prin123    │ Principal   │"
echo "  │ coordinator1   │ coord123   │ Coordinator │"
echo "  │ coordinator2   │ coord456   │ Coordinator │"
echo "  │ registrar      │ reg123     │ Registrar   │"
echo "  │ dean1          │ dean123    │ Dean        │"
echo "  │ dean2          │ dean456    │ Dean        │"
echo "  │ teacher1       │ teach123   │ Teacher     │"
echo "  │ teacher2       │ teach456   │ Teacher     │"
echo "  │ teacher3       │ teach789   │ Teacher     │"
echo "  └────────────────┴────────────┴─────────────┘"
echo ""
echo "  Press Ctrl+C to stop"

wait $BACKEND_PID
