from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert

from app.db.models import (
    BrowsingSessionRecord,
    FeedbackEventRecord,
    RecommendationLogRecord,
    SessionRecord,
    UserRecord,
)
from app.db.session import get_session_factory
from app.models.user_context import FeedbackChip, FeedbackEvent, FeedbackEventType
from app.models.browsing_session import BrowsingSession
from app.services.feedback_engine import MAX_FEEDBACK_EVENTS
from app.services.session import SessionData
from app.services.token_crypto import decrypt_token, encrypt_token


def _to_session_data(record: SessionRecord) -> SessionData:
    return SessionData(
        session_id=record.session_id,
        spotify_user_id=record.user_id,
        access_token=record.access_token,
        refresh_token=decrypt_token(record.refresh_token_encrypted),
        expires_at=record.expires_at,
    )


def _feedback_from_record(record: FeedbackEventRecord) -> FeedbackEvent:
    return FeedbackEvent(
        track_id=record.track_id,
        event_type=FeedbackEventType(record.event_type),
        chips=[FeedbackChip(chip) for chip in record.chips],
        query=record.query,
        timestamp=record.created_at.isoformat(),
    )


class PostgresSessionStore:
    async def _ensure_user(self, user_id: str) -> None:
        session_factory = get_session_factory()
        async with session_factory() as db:
            await db.execute(
                insert(UserRecord)
                .values(id=user_id)
                .on_conflict_do_nothing(index_elements=[UserRecord.id])
            )
            await db.commit()

    async def create(self, session: SessionData) -> SessionData:
        await self._ensure_user(session.spotify_user_id)
        session_factory = get_session_factory()
        async with session_factory() as db:
            await db.execute(
                delete(SessionRecord).where(
                    SessionRecord.user_id == session.spotify_user_id,
                )
            )
            db.add(
                SessionRecord(
                    session_id=session.session_id,
                    user_id=session.spotify_user_id,
                    access_token=session.access_token,
                    refresh_token_encrypted=encrypt_token(session.refresh_token),
                    expires_at=session.expires_at,
                )
            )
            await db.commit()
        return session

    async def get(self, session_id: str) -> SessionData | None:
        session_factory = get_session_factory()
        async with session_factory() as db:
            result = await db.execute(
                select(SessionRecord).where(SessionRecord.session_id == session_id)
            )
            record = result.scalar_one_or_none()
            if record is None:
                return None
            return _to_session_data(record)

    async def update(self, session: SessionData) -> None:
        session_factory = get_session_factory()
        async with session_factory() as db:
            result = await db.execute(
                select(SessionRecord).where(SessionRecord.session_id == session.session_id)
            )
            record = result.scalar_one_or_none()
            if record is None:
                return
            record.access_token = session.access_token
            record.refresh_token_encrypted = encrypt_token(session.refresh_token)
            record.expires_at = session.expires_at
            await db.commit()

    async def delete(self, session_id: str) -> None:
        session_factory = get_session_factory()
        async with session_factory() as db:
            await db.execute(
                delete(SessionRecord).where(SessionRecord.session_id == session_id)
            )
            await db.commit()


class PostgresBrowsingSessionStore:
    async def _ensure_user(self, user_id: str) -> None:
        session_factory = get_session_factory()
        async with session_factory() as db:
            await db.execute(
                insert(UserRecord)
                .values(id=user_id)
                .on_conflict_do_nothing(index_elements=[UserRecord.id])
            )
            await db.commit()

    async def _load_feedback_events(self, user_id: str) -> list[FeedbackEvent]:
        session_factory = get_session_factory()
        async with session_factory() as db:
            result = await db.execute(
                select(FeedbackEventRecord)
                .where(FeedbackEventRecord.user_id == user_id)
                .order_by(FeedbackEventRecord.created_at.desc())
                .limit(MAX_FEEDBACK_EVENTS)
            )
            records = list(result.scalars().all())
        records.reverse()
        return [_feedback_from_record(record) for record in records]

    async def get(self, user_id: str) -> BrowsingSession:
        await self._ensure_user(user_id)
        session_factory = get_session_factory()
        async with session_factory() as db:
            result = await db.execute(
                select(BrowsingSessionRecord).where(
                    BrowsingSessionRecord.user_id == user_id,
                )
            )
            record = result.scalar_one_or_none()

        if record is None:
            browsing = BrowsingSession(user_id=user_id)
        else:
            browsing = BrowsingSession(
                user_id=user_id,
                first_search=record.first_search,
                current_query=record.current_query,
                exploration_profile=record.exploration_profile,
                novelty_tolerance=record.novelty_tolerance,
                updated_at=record.updated_at,
            )

        browsing.feedback_events = await self._load_feedback_events(user_id)
        return browsing.model_copy(deep=True)

    async def set_query(self, user_id: str, query: str | None) -> BrowsingSession:
        browsing = await self.get(user_id)
        browsing.apply_query(query)
        await self.save(browsing)
        return browsing.model_copy(deep=True)

    async def save(self, session: BrowsingSession) -> None:
        await self._ensure_user(session.user_id)
        session.updated_at = datetime.now(timezone.utc)
        session_factory = get_session_factory()
        async with session_factory() as db:
            result = await db.execute(
                select(BrowsingSessionRecord).where(
                    BrowsingSessionRecord.user_id == session.user_id,
                )
            )
            record = result.scalar_one_or_none()
            if record is None:
                record = BrowsingSessionRecord(user_id=session.user_id)
                db.add(record)

            record.first_search = session.first_search
            record.current_query = session.current_query
            record.exploration_profile = session.exploration_profile
            record.novelty_tolerance = session.novelty_tolerance
            record.updated_at = session.updated_at

            count_result = await db.execute(
                select(func.count())
                .select_from(FeedbackEventRecord)
                .where(FeedbackEventRecord.user_id == session.user_id)
            )
            existing_count = count_result.scalar_one()
            new_events = session.feedback_events[existing_count:]
            for event in new_events:
                db.add(
                    FeedbackEventRecord(
                        user_id=session.user_id,
                        track_id=event.track_id,
                        event_type=event.event_type.value,
                        chips=[chip.value for chip in event.chips],
                        query=event.query,
                        created_at=(
                            datetime.fromisoformat(event.timestamp)
                            if event.timestamp
                            else datetime.now(timezone.utc)
                        ),
                    )
                )

            await db.commit()

    async def clear(self, user_id: str) -> None:
        session_factory = get_session_factory()
        async with session_factory() as db:
            await db.execute(
                delete(FeedbackEventRecord).where(
                    FeedbackEventRecord.user_id == user_id,
                )
            )
            result = await db.execute(
                select(BrowsingSessionRecord).where(
                    BrowsingSessionRecord.user_id == user_id,
                )
            )
            record = result.scalar_one_or_none()
            if record is None:
                record = BrowsingSessionRecord(user_id=user_id)
                db.add(record)
            record.first_search = None
            record.current_query = None
            record.exploration_profile = 0.5
            record.novelty_tolerance = 0.5
            record.updated_at = datetime.now(timezone.utc)
            await db.commit()


async def log_recommendation_generation(
    *,
    user_id: str,
    query: str,
    candidate_count: int,
    recommendation_count: int,
    used_ai: bool,
) -> None:
    session_factory = get_session_factory()
    async with session_factory() as db:
        await db.execute(
            insert(UserRecord)
            .values(id=user_id)
            .on_conflict_do_nothing(index_elements=[UserRecord.id])
        )
        db.add(
            RecommendationLogRecord(
                user_id=user_id,
                query=query,
                candidate_count=candidate_count,
                recommendation_count=recommendation_count,
                used_ai=used_ai,
            )
        )
        await db.commit()
