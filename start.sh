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
echo "  Open frontend/index.html in your browser"
echo ""
echo "  Default Accounts:"
echo "  ┌────────────────┬────────────┬─────────────┐"
echo "  │ Username       │ Password   │ Role        │"
echo "  ├────────────────┼────────────┼─────────────┤"
echo "  │ admin          │ admin123   │ Admin       │"
echo "  │ coordinator    │ coord123   │ Coordinator │"
echo "  │ teacher1       │ teach123   │ Teacher     │"
echo "  │ principal      │ prin123    │ Admin       │"
echo "  └────────────────┴────────────┴─────────────┘"
echo ""
echo "  Press Ctrl+C to stop"

wait $BACKEND_PID
