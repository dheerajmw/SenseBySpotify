from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.models.user_context import FeedbackChip, FeedbackEvent, FeedbackEventType
from app.models.browsing_session import BrowsingSession
from app.services.browsing_session import browsing_session_store

logger = logging.getLogger(__name__)

MAX_FEEDBACK_EVENTS = 100
DEDUPE_WINDOW_SECONDS = 2


def _event_key(event: FeedbackEvent) -> str:
    chips = ",".join(chip.value for chip in event.chips)
    return f"{event.event_type.value}:{event.track_id}:{chips}:{event.query}"


def is_duplicate_event(session: BrowsingSession, event: FeedbackEvent) -> bool:
    if not session.feedback_events:
        return False
    latest = session.feedback_events[-1]
    if _event_key(latest) != _event_key(event):
        return False
    if not latest.timestamp or not event.timestamp:
        return True
    latest_at = datetime.fromisoformat(latest.timestamp)
    current_at = datetime.fromisoformat(event.timestamp)
    return (current_at - latest_at).total_seconds() < DEDUPE_WINDOW_SECONDS


def apply_feedback_heuristics(
    session: BrowsingSession,
    event: FeedbackEvent,
) -> BrowsingSession:
    if event.event_type == FeedbackEventType.SKIP:
        session.novelty_tolerance = max(0.0, session.novelty_tolerance - 0.08)
        session.exploration_profile = max(0.0, session.exploration_profile - 0.05)
    elif event.event_type == FeedbackEventType.REPLAY:
        session.exploration_profile = min(1.0, session.exploration_profile + 0.04)
    elif event.event_type == FeedbackEventType.COMPLETE:
        session.exploration_profile = min(1.0, session.exploration_profile + 0.03)
    elif event.event_type == FeedbackEventType.LIKE:
        session.exploration_profile = min(1.0, session.exploration_profile + 0.05)
    elif event.event_type == FeedbackEventType.UNLIKE:
        session.exploration_profile = max(0.0, session.exploration_profile - 0.02)
    elif event.event_type == FeedbackEventType.DISLIKE:
        session.novelty_tolerance = max(0.0, session.novelty_tolerance - 0.1)
        session.exploration_profile = max(0.0, session.exploration_profile - 0.08)
    elif event.event_type == FeedbackEventType.UNDISLIKE:
        session.exploration_profile = min(1.0, session.exploration_profile + 0.02)
    elif event.event_type == FeedbackEventType.SEARCH and event.query:
        session.apply_query(event.query)

    for chip in event.chips:
        if chip == FeedbackChip.SURPRISE_ME:
            session.novelty_tolerance = min(1.0, session.novelty_tolerance + 0.12)
            session.exploration_profile = min(1.0, session.exploration_profile + 0.08)
        elif chip == FeedbackChip.SIMILAR_ARTIST:
            session.novelty_tolerance = max(0.0, session.novelty_tolerance - 0.06)
        elif chip in {FeedbackChip.MOOD, FeedbackChip.LYRICS, FeedbackChip.VOCALS, FeedbackChip.BEAT}:
            session.exploration_profile = min(1.0, session.exploration_profile + 0.02)
        elif chip == FeedbackChip.INSTRUMENTAL:
            session.novelty_tolerance = max(0.0, session.novelty_tolerance - 0.03)

    session.novelty_tolerance = round(min(1.0, max(0.0, session.novelty_tolerance)), 2)
    session.exploration_profile = round(min(1.0, max(0.0, session.exploration_profile)), 2)
    return session


class FeedbackEngine:
    async def record(
        self,
        user_id: str,
        *,
        track_id: str | None,
        event_type: FeedbackEventType,
        chips: list[FeedbackChip] | None = None,
        query: str | None = None,
    ) -> BrowsingSession:
        session = await browsing_session_store.get(user_id)
        event = FeedbackEvent(
            track_id=track_id,
            event_type=event_type,
            chips=chips or [],
            query=query,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

        if is_duplicate_event(session, event):
            logger.info("Duplicate feedback ignored for user %s", user_id)
            return session

        session.feedback_events.append(event)
        if len(session.feedback_events) > MAX_FEEDBACK_EVENTS:
            session.feedback_events = session.feedback_events[-MAX_FEEDBACK_EVENTS:]

        session = apply_feedback_heuristics(session, event)
        await browsing_session_store.save(session)
        logger.info(
            "Feedback recorded user=%s type=%s track=%s chips=%s",
            user_id,
            event_type.value,
            track_id,
            [chip.value for chip in event.chips],
        )
        return session

    async def clear(self, user_id: str) -> None:
        await browsing_session_store.clear(user_id)


feedback_engine = FeedbackEngine()
