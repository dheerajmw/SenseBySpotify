from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from app.models.browsing_session import BrowsingSession
from app.services.session import SessionData


class MemorySessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, SessionData] = {}
        self._user_sessions: dict[str, str] = {}
        self._lock = asyncio.Lock()

    async def create(self, session: SessionData) -> SessionData:
        async with self._lock:
            existing_id = self._user_sessions.get(session.spotify_user_id)
            if existing_id:
                self._sessions.pop(existing_id, None)
            self._sessions[session.session_id] = session
            self._user_sessions[session.spotify_user_id] = session.session_id
            return session

    async def get(self, session_id: str) -> SessionData | None:
        async with self._lock:
            return self._sessions.get(session_id)

    async def update(self, session: SessionData) -> None:
        async with self._lock:
            if session.session_id in self._sessions:
                self._sessions[session.session_id] = session

    async def delete(self, session_id: str) -> None:
        async with self._lock:
            session = self._sessions.pop(session_id, None)
            if session:
                mapped_id = self._user_sessions.get(session.spotify_user_id)
                if mapped_id == session_id:
                    self._user_sessions.pop(session.spotify_user_id, None)


class MemoryBrowsingSessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, BrowsingSession] = {}
        self._lock = asyncio.Lock()

    async def get(self, user_id: str) -> BrowsingSession:
        async with self._lock:
            session = self._sessions.get(user_id)
            if session is None:
                session = BrowsingSession(user_id=user_id)
                self._sessions[user_id] = session
            return session.model_copy(deep=True)

    async def set_query(self, user_id: str, query: str | None) -> BrowsingSession:
        async with self._lock:
            session = self._sessions.get(user_id)
            if session is None:
                session = BrowsingSession(user_id=user_id)
                self._sessions[user_id] = session
            session.apply_query(query)
            self._sessions[user_id] = session
            return session.model_copy(deep=True)

    async def save(self, session: BrowsingSession) -> None:
        async with self._lock:
            session.updated_at = datetime.now(timezone.utc)
            self._sessions[session.user_id] = session

    async def clear(self, user_id: str) -> None:
        async with self._lock:
            self._sessions[user_id] = BrowsingSession(user_id=user_id)


class OAuthStateStore:
    def __init__(self, ttl_minutes: int = 10) -> None:
        self._states: dict[str, datetime] = {}
        self._lock = asyncio.Lock()
        self._ttl = timedelta(minutes=ttl_minutes)

    async def create(self, state: str) -> str:
        async with self._lock:
            self._purge_expired_locked()
            self._states[state] = datetime.now(timezone.utc)
            return state

    async def validate_and_consume(self, state: str) -> bool:
        async with self._lock:
            self._purge_expired_locked()
            created_at = self._states.pop(state, None)
            if created_at is None:
                return False
            return datetime.now(timezone.utc) - created_at <= self._ttl

    def _purge_expired_locked(self) -> None:
        now = datetime.now(timezone.utc)
        expired = [
            state
            for state, created_at in self._states.items()
            if now - created_at > self._ttl
        ]
        for state in expired:
            self._states.pop(state, None)
