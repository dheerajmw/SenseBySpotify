# Problem Statement

## Background

Spotify's recommendation experience is built primarily on historical listening behavior: liked songs, playlists, listening history, and collaborative filtering. This works well for capturing **long-term taste**, but it is weaker at understanding **what the user wants right now**.

## The Problem

Users often experience:

- **Repetitive recommendations** that mirror past listening rather than current intent
- **Manual searching** to find music that fits the moment
- **Low trust** in suggestions that feel generic or poorly explained

The gap is not a lack of data—it is a lack of **session-aware reasoning**. Spotify knows what you have listened to; it does not always know *why* you are listening today, how open you are to something new, or how your mood and context have shifted.

## Proposed Solution

This project adds **Sense By spotify** on top of Spotify's existing discovery flow. Instead of relying only on historical signals, an AI reasoning engine continuously interprets real-time listening context and produces personalized discovery recommendations with clear explanations.

The layer combines four inputs:

| Signal | What it captures |
|--------|------------------|
| **Current session intent** | What the user is looking for right now (mood, activity, search, recent plays) |
| **Long-term listening taste** | Stable preferences from top artists, genres, and history |
| **Exploration profile** | How much the user tends to branch beyond familiar artists |
| **Novelty tolerance** | Willingness to accept unfamiliar or surprising suggestions |

Throughout a session, the system:

1. Builds a live picture of user context
2. Generates discovery recommendations aligned with intent and taste
3. Explains why each track was chosen
4. Adapts using lightweight contextual feedback (skips, replays, likes, feedback chips)

## Objectives

- Help users discover **relevant unfamiliar music** without endless manual search
- Reduce recommendation fatigue by balancing familiarity with exploration
- Increase **trust** through transparent, per-track explanations
- Improve session relevance as context and feedback evolve

## Success Criteria

The MVP is successful if users can:

- Describe what they want in natural language or through listening behavior
- Receive ranked recommendations that feel appropriate for the current moment
- Understand why each recommendation was made
- See recommendations improve within a session as they interact with the feed
