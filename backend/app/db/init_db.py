from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncEngine

from app.db.base import Base
from app.db import models  # noqa: F401

logger = logging.getLogger(__name__)


async def init_db(engine: AsyncEngine) -> None:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    logger.info("Database schema initialized")
