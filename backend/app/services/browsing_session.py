from __future__ import annotations

from typing import Protocol

from app.config import get_settings
from app.models.browsing_session import BrowsingSession
from app.services.memory_stores import MemoryBrowsingSessionStore


class BrowsingSessionStoreProtocol(Protocol):
    async def get(self, user_id: str) -> BrowsingSession: ...

    async def set_query(self, user_id: str, query: str | None) -> BrowsingSession: ...

    async def save(self, session: BrowsingSession) -> None: ...

    async def clear(self, user_id: str) -> None: ...


class _BrowsingSessionStoreProxy:
    def __init__(self) -> None:
        self._store: BrowsingSessionStoreProtocol | None = None

    def _resolve(self) -> BrowsingSessionStoreProtocol:
        if self._store is None:
            settings = get_settings()
            if settings.use_postgres:
                from app.services.postgres_stores import PostgresBrowsingSessionStore

                self._store = PostgresBrowsingSessionStore()
            else:
                self._store = MemoryBrowsingSessionStore()
        return self._store

    def reset(self) -> None:
        self._store = None

    async def get(self, user_id: str) -> BrowsingSession:
        return await self._resolve().get(user_id)

    async def set_query(self, user_id: str, query: str | None) -> BrowsingSession:
        return await self._resolve().set_query(user_id, query)

    async def save(self, session: BrowsingSession) -> None:
        await self._resolve().save(session)

    async def clear(self, user_id: str) -> None:
        await self._resolve().clear(user_id)


browsing_session_store = _BrowsingSessionStoreProxy()
