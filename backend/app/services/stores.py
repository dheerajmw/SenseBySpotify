from __future__ import annotations

from typing import Protocol

from app.config import get_settings
from app.services.memory_stores import MemorySessionStore, OAuthStateStore
from app.services.session import SessionData


class SessionStoreProtocol(Protocol):
    async def create(self, session: SessionData) -> SessionData: ...

    async def get(self, session_id: str) -> SessionData | None: ...

    async def update(self, session: SessionData) -> None: ...

    async def delete(self, session_id: str) -> None: ...


class _SessionStoreProxy:
    def __init__(self) -> None:
        self._store: SessionStoreProtocol | None = None

    def _resolve(self) -> SessionStoreProtocol:
        if self._store is None:
            settings = get_settings()
            if settings.use_postgres:
                from app.services.postgres_stores import PostgresSessionStore

                self._store = PostgresSessionStore()
            else:
                self._store = MemorySessionStore()
        return self._store

    def reset(self) -> None:
        self._store = None

    async def create(self, session: SessionData) -> SessionData:
        return await self._resolve().create(session)

    async def get(self, session_id: str) -> SessionData | None:
        return await self._resolve().get(session_id)

    async def update(self, session: SessionData) -> None:
        await self._resolve().update(session)

    async def delete(self, session_id: str) -> None:
        await self._resolve().delete(session_id)


session_store = _SessionStoreProxy()
oauth_state_store = OAuthStateStore()
