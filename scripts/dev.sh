#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Starting backend on http://127.0.0.1:8000"
cd "$ROOT/backend"
source .venv/bin/activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

echo "Starting frontend on http://127.0.0.1:5173"
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

trap 'kill $BACKEND_PID $FRONTEND_PID 2>/dev/null' EXIT

echo ""
echo "Sense By spotify ready: http://127.0.0.1:5173"
echo "Press Ctrl+C to stop both servers"
wait
