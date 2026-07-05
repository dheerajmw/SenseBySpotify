# Sense

AI-powered music discovery that understands your listening intent. Built with React, FastAPI, iTunes Search API, and OpenAI.

## Quick start

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add OPENAI_API_KEY
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://127.0.0.1:5173**

## App flow

1. **Welcome** — Get Started (no multi-step wizard)
2. **Session intent prompt** — mood chips or free text → recommendations → Feed *(only onboarding input)*
3. **Home / Feed / Search / AI Discovery** — browse, listen, feedback
4. **Session learning** — mood adapts from listening; new tab or 2h idle → prompt again

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/search/artists?q=` | iTunes artist search |
| `GET` | `/search?q=` | iTunes track search |
| `POST` | `/generate-recommendations` | Profile + intent → ranked recommendations |

No authentication required. User profile and feedback are stored in browser `localStorage`.

## Environment

**Backend** (`backend/.env`):

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
CORS_ORIGINS=http://127.0.0.1:5173
```

**Frontend** (`frontend/.env`):

```
VITE_API_BASE_URL=/api
```

## Stack

- **Frontend:** React, TypeScript, Tailwind, Vite
- **Backend:** FastAPI
- **Music:** iTunes Search API (no API key required)
- **AI:** OpenAI
- **Storage:** localStorage (MVP)
