# Edge Cases

Detailed edge cases for [Sense By spotify](./architecture.md), organized by system area. Each entry describes the scenario, expected system behavior, and suggested handling.

**Priority legend:** `P0` — breaks core flow · `P1` — degrades trust or quality · `P2` — polish / secondary paths

---

## 1. Authentication & OAuth

| ID | Edge Case | Expected Behavior | Priority |
|----|-----------|-------------------|----------|
| AUTH-01 | User denies Spotify consent on OAuth screen | Redirect to Login with clear message; do not create partial session | P0 |
| AUTH-02 | OAuth `state` parameter missing or tampered | Reject callback; log security event; show "Login failed, try again" | P0 |
| AUTH-03 | Authorization code expired or reused | Return 401; force fresh login; do not retry same code | P0 |
| AUTH-04 | Redirect URI mismatch (local vs production) | Spotify returns error; surface config hint in dev logs only | P0 |
| AUTH-05 | Access token expires mid-session | Silently refresh with refresh token; retry failed Spotify call once | P0 |
| AUTH-06 | Refresh token revoked or expired | Clear session; redirect to Login; preserve no stale user data in UI | P0 |
| AUTH-07 | User revokes app access in Spotify settings | Next API call fails with 401; prompt re-authentication | P1 |
| AUTH-08 | Multiple tabs open during OAuth callback | Only one tab completes login; others detect existing session or show "already logged in" | P1 |
| AUTH-09 | User closes browser during OAuth redirect | No session created; safe to restart login | P2 |
| AUTH-10 | Spotify account is Free tier with playback restrictions | App still works for search/recommendations; disable or hide playback-only features | P1 |
| AUTH-11 | Spotify account has no email or display name | Show fallback identifier (Spotify ID); do not crash profile UI | P2 |
| AUTH-12 | Concurrent login requests from same user | Idempotent token exchange; last valid session wins or merge by user ID | P1 |

---

## 2. Spotify API & Listening Data

| ID | Edge Case | Expected Behavior | Priority |
|----|-----------|-------------------|----------|
| SPOT-01 | Spotify API returns 429 (rate limit) | Exponential backoff; return partial context if some calls succeed; show "try again" if all fail | P0 |
| SPOT-02 | Spotify API returns 503 / timeout | Retry up to 2 times; fallback to cached profile data if available | P0 |
| SPOT-03 | New Spotify user with no listening history | `top-artists`, `top-tracks`, `recently-played` empty; rely on prompt + search only; set default exploration/novelty | P0 |
| SPOT-04 | `recently-played` empty (inactive account) | Omit from context; AI prompt should not reference "currently listening" falsely | P0 |
| SPOT-05 | `user-library-read` scope denied — liked songs unavailable | Skip liked songs in context; document reduced taste signal in dev | P1 |
| SPOT-06 | Top artists/tracks span only one genre (hyper-niche listener) | Genre derivation still works; AI should avoid over-narrowing candidates | P1 |
| SPOT-07 | Top artists/tracks are stale (user changed taste recently) | Weight `recently-played` and session feedback higher than top lists in AI prompt | P1 |
| SPOT-08 | Recently played includes podcasts / non-music | Filter to `type=track` only; exclude episodes from candidate seeding | P1 |
| SPOT-09 | Track unavailable in user's market (region lock) | Exclude from recommendations; do not link to unplayable URIs | P1 |
| SPOT-10 | Track removed from Spotify catalogue after recommendation | Detail page shows "unavailable"; remove from feed on refresh | P2 |
| SPOT-11 | Search returns zero results for query | Return empty feed with message; suggest broader prompt | P0 |
| SPOT-12 | Search query is very long (>500 chars) | Truncate or reject with 400; prompt user to shorten | P1 |
| SPOT-13 | Search query contains only special characters or emoji | Validate input; return empty or sanitized search | P2 |
| SPOT-14 | Duplicate tracks across search result pages | Dedupe by `track_id` before sending to AI | P1 |
| SPOT-15 | Same artist dominates all search candidates | Enforce artist diversity cap (e.g. max 2 per artist in top 10) | P1 |
| SPOT-16 | Album art URL missing or broken | Show placeholder image; do not block card render | P2 |
| SPOT-17 | Spotify pagination not fully fetched — thin candidate pool | If candidates < minimum threshold (e.g. 10), broaden search terms automatically | P1 |

---

## 3. User Context Builder

| ID | Edge Case | Expected Behavior | Priority |
|----|-----------|-------------------|----------|
| CTX-01 | Partial Spotify fetch failure (e.g. top-tracks fails, rest OK) | Build context from available fields; flag `incomplete: true` internally | P0 |
| CTX-02 | Session has no `first_search` yet — user went straight to AI prompt | Use AI prompt as `first_search` and `current_query` | P1 |
| CTX-03 | User changes search query mid-session without new generate call | Update `current_query` on search event; keep `first_search` immutable | P1 |
| CTX-04 | Conflicting signals: top artists are metal, prompt asks for "chill jazz" | AI must prioritize **session intent** over long-term taste | P0 |
| CTX-05 | Feedback says "Surprise Me" but user previously skipped all novel tracks | Raise novelty in prompt but cap confidence; avoid jarring jumps | P1 |
| CTX-06 | Feedback chips conflict (e.g. Instrumental + Lyrics) | Store both; AI treats as broad positive signal, not contradiction error | P2 |
| CTX-07 | Very large feedback history in one session (100+ events) | Summarize or window last N events for AI context token limits | P1 |
| CTX-08 | Context build exceeds token budget for LLM | Truncate: keep recent plays, current query, last 10 feedback events, top 5 artists | P0 |
| CTX-09 | Two devices, same user, different sessions | Sessions are independent per device/browser unless DB ties them | P2 |
| CTX-10 | `exploration_profile` / `novelty_tolerance` not yet inferable | Use neutral defaults (medium exploration, medium novelty) | P1 |
| CTX-11 | Liked songs list is huge (thousands) | Sample or aggregate (genre/artist counts); never send full list to LLM | P1 |

---

## 4. Session Intent (Problem Signal)

| ID | Edge Case | Expected Behavior | Priority |
|----|-----------|-------------------|----------|
| INT-01 | Empty AI prompt and no recent search | Use recently played + top artists to infer intent; or prompt user for input | P0 |
| INT-02 | Vague prompt: "good music" | AI interprets broadly; explanations acknowledge uncertainty; lower confidence scores | P1 |
| INT-03 | Contradictory prompt: "heavy metal for sleeping" | AI resolves tension explicitly in explanation or asks implicit best-effort blend | P1 |
| INT-04 | Prompt requests illegal/offensive content | Refuse generation; return safe error message; do not call search with harmful terms | P0 |
| INT-05 | Prompt references specific song/artist not in catalogue | Search by name; if not found, explain and suggest closest matches | P1 |
| INT-06 | User intent shifts rapidly (workout → sleep in 2 minutes) | Recent search + feedback outweigh stale prompt; re-generate reflects latest intent | P1 |
| INT-07 | Non-English prompt | Support multilingual intent in AI; search using original or translated keywords | P2 |
| INT-08 | Prompt includes activity context ("for a 5K run") | Map to tempo/energy heuristics in search query expansion | P1 |
| INT-09 | User only browses Home widgets, never submits prompt | Passive intent from recently played only; discovery entry suggests a starter prompt | P2 |

---

## 5. Long-Term Taste (Problem Signal)

| ID | Edge Case | Expected Behavior | Priority |
|----|-----------|-------------------|----------|
| TASTE-01 | User's top artists are all mainstream pop — discovery feels repetitive | Increase novelty weight when user selects "Surprise Me" or skips familiar artists | P1 |
| TASTE-02 | User has eclectic taste (many genres in top artists) | Avoid single-genre collapse; diversify candidate queries | P1 |
| TASTE-03 | Recommended track is already in user's liked songs | Penalize in ranking; prefer unfamiliar tracks per product goal | P1 |
| TASTE-04 | Recommended track is in recently played (last 50) | Deprioritize or exclude; surface truly new discoveries | P1 |
| TASTE-05 | AI over-indexes on one top artist ("everything sounds like X") | Artist diversity cap + exploration profile in prompt | P1 |
| TASTE-06 | New user — taste signals empty | Do not fabricate taste; explanations reference prompt only | P0 |
| TASTE-07 | Taste data is dominated by shared-account listening | No mitigation in MVP; optional future: "personalize for this session only" mode | P2 |

---

## 6. Exploration Profile & Novelty Tolerance

| ID | Edge Case | Expected Behavior | Priority |
|----|-----------|-------------------|----------|
| NOV-01 | User skips every unfamiliar artist | Lower `novelty_tolerance` for session; bias toward top-artist adjacency | P1 |
| NOV-02 | User likes "Surprise Me" then skips all results | Treat chip as intent, not guarantee; reduce novelty after consecutive skips | P1 |
| NOV-03 | User replays only familiar artists, skips all new ones | Exploration profile → low; recommendations stay in comfort zone | P1 |
| NOV-04 | User wants novelty but every novel track is skipped | Show message suggesting narrower prompt; do not keep escalating randomness | P1 |
| NOV-05 | Zero exploration history in session | Default medium novelty; adjust after 3+ feedback events | P2 |
| NOV-06 | AI recommends only safe mainstream tracks for adventurous user | Prompt instructs minimum % of non-top-artist candidates in output | P1 |
| NOV-07 | Confidence score high but track is wildly off-taste | Cap confidence when taste/intent alignment is weak in prompt rules | P1 |

---

## 7. AI Reasoning Engine

| ID | Edge Case | Expected Behavior | Priority |
|----|-----------|-------------------|----------|
| AI-01 | LLM returns malformed JSON | Retry once with stricter schema instruction; then fallback ranking | P0 |
| AI-02 | LLM hallucinates `track_id` not in candidate list | Validate IDs against candidates; drop invalid rows; backfill from unranked pool | P0 |
| AI-03 | LLM timeout (>30s) | Return Spotify search order with template explanation; log for monitoring | P0 |
| AI-04 | LLM rate limit or quota exceeded | Queue or reject with 503; show "AI temporarily unavailable" | P0 |
| AI-05 | LLM returns duplicate ranks or gaps in ranking | Normalize to contiguous ranks 1..N | P1 |
| AI-06 | Explanation is generic ("Great song you'll love") | Post-validate explanations; regenerate if below quality threshold | P1 |
| AI-07 | Explanation references wrong artist or mood | Cross-check against track metadata; regenerate or use template | P1 |
| AI-08 | Explanation leaks system prompt or internal fields | Strip internal keys; never expose raw prompt to frontend | P0 |
| AI-09 | Confidence scores all identical (e.g. 0.85 each) | Acceptable for MVP; optionally spread via rank-derived confidence | P2 |
| AI-10 | Confidence score out of range (<0 or >1) | Clamp to [0, 1] | P1 |
| AI-11 | Candidate pool empty — AI still invoked | Skip AI call; return empty with clear message | P0 |
| AI-12 | Provider failover (OpenAI down, switch to Groq) | Abstract provider; same output schema; log provider used | P1 |
| AI-13 | Prompt injection in user query ("ignore instructions…") | System prompt hardening; treat user input as untrusted data block | P0 |
| AI-14 | Extremely long user prompt (token bomb) | Truncate input; max length validation on API | P1 |

---

## 8. Recommendation Generator

| ID | Edge Case | Expected Behavior | Priority |
|----|-----------|-------------------|----------|
| GEN-01 | `POST /generate-recommendations` called twice in parallel | Both complete independently; UI uses latest response (request ID or timestamp) | P1 |
| GEN-02 | User spams generate button | Debounce on frontend; rate limit on backend (e.g. 1 req / 10s) | P1 |
| GEN-03 | `limit` param is 0, negative, or >50 | Clamp to sensible default (e.g. 10) or return 400 | P2 |
| GEN-04 | Same context + query produces different rankings (LLM non-determinism) | Acceptable; optionally set low temperature for stability | P2 |
| GEN-05 | All candidates filtered out after market/availability checks | Return empty list; suggest different query | P1 |
| GEN-06 | Generate called before login/session expired | Return 401; frontend redirects to Login | P0 |
| GEN-07 | Generate called with stale session feedback not yet persisted | Read latest in-memory/DB session before build context | P1 |
| GEN-08 | Response includes tracks user already saw in current feed | Optional dedupe against `shown_track_ids` in session | P2 |

---

## 9. Feedback Engine

### Passive Feedback

| ID | Edge Case | Expected Behavior | Priority |
|----|-----------|-------------------|----------|
| FB-01 | Skip fired before track fully loaded | Ignore or debounce; require minimum listen threshold if playback SDK added | P2 |
| FB-02 | Multiple skips in <1 second | Batch or count as single negative signal | P2 |
| FB-03 | Replay event without prior play | Ignore orphan replay | P2 |
| FB-04 | Song completion never fires (user leaves app) | No completion signal; do not penalize | P2 |
| FB-05 | Search event on every keystroke | Debounce search feedback; fire on submit or 500ms idle | P1 |
| FB-06 | Passive feedback for track not in current recommendation set | Still store; may indicate general taste signal | P2 |

### Explicit Feedback

| ID | Edge Case | Expected Behavior | Priority |
|----|-----------|-------------------|----------|
| FB-07 | User likes track but dismisses feedback popup | Record `like` without chips; do not block like action | P1 |
| FB-08 | User selects multiple chips | Store all; pass array to context builder | P1 |
| FB-09 | User un-likes after submitting chips | Remove or negate like event; optional chip rollback | P2 |
| FB-10 | Feedback submitted for invalid `track_id` | Return 400; do not corrupt session | P1 |
| FB-11 | `POST /feedback` without auth | Return 401 | P0 |
| FB-12 | Feedback storm after feed load (automated double-clicks) | Idempotency key or dedupe same event within 2s window | P1 |

### Adaptation Loop

| ID | Edge Case | Expected Behavior | Priority |
|----|-----------|-------------------|----------|
| FB-13 | User expects instant feed update after feedback | Either auto-refresh feed or show "Refresh recommendations" CTA | P1 |
| FB-14 | Re-generate after one skip — no visible change | Ensure skip weight is high enough in prompt; log context diff for debug | P1 |
| FB-15 | Contradictory feedback (like then skip same track) | Latest event wins or net score toward neutral | P1 |
| FB-16 | Session feedback lost on server restart (pre-PostgreSQL) | Document limitation; Phase 7 persistence fixes | P1 |

---

## 10. Frontend & UX

| ID | Edge Case | Expected Behavior | Priority |
|----|-----------|-------------------|----------|
| UI-01 | Slow network — Home widgets load at different speeds | Independent skeletons per widget; no full-page block | P1 |
| UI-02 | Generate recommendations takes >10s | Show progress message; allow cancel in future; prevent duplicate submits | P1 |
| UI-03 | User navigates away during generate | Abort in-flight request; discard stale response on return | P2 |
| UI-04 | Recommendation card missing album art | Placeholder image | P2 |
| UI-05 | Very long track or artist name | Truncate with ellipsis; full name on detail page | P2 |
| UI-06 | Confidence shown as decimal vs percentage — inconsistent | Standardize (e.g. "87% match") across app | P2 |
| UI-07 | "Why Recommended" text overflows on mobile | Expandable section; max lines with "Read more" | P2 |
| UI-08 | Deep link to Recommendation Details for invalid ID | Show 404 state; link back to feed | P2 |
| UI-09 | Browser back button after OAuth | Land on Home or Login consistently; no token in URL fragment leaked | P1 |
| UI-10 | Accessibility: feedback chips not keyboard-navigable | Chips focusable and selectable via keyboard | P2 |

---

## 11. API & Backend General

| ID | Edge Case | Expected Behavior | Priority |
|----|-----------|-------------------|----------|
| API-01 | Missing `Content-Type: application/json` on POST | Return 415 with clear error | P2 |
| API-02 | Invalid JSON body | Return 422 with validation details | P1 |
| API-03 | CORS preflight from unauthorized origin | Reject in production; allow only Vercel origin | P0 |
| API-04 | Request body exceeds size limit | Return 413 | P2 |
| API-05 | Internal unhandled exception | Return 500 generic message; log stack server-side | P0 |
| API-06 | Health check passes but Spotify/AI down | Optional deep health endpoint for ops; user-facing graceful degradation | P2 |

---

## 12. Database & Persistence (Phase 7+)

| ID | Edge Case | Expected Behavior | Priority |
|----|-----------|-------------------|----------|
| DB-01 | PostgreSQL connection lost mid-request | Retry once; fail gracefully; do not lose OAuth tokens in flight | P1 |
| DB-02 | Duplicate user record on re-login | Upsert by Spotify user ID | P1 |
| DB-03 | Feedback events table grows unbounded | Partition or prune sessions older than retention window | P2 |
| DB-04 | Refresh token storage — DB breach risk | Encrypt at rest; never return tokens to frontend | P0 |
| DB-05 | Migration failure on deploy | Rollback deploy; health check fails until DB ready | P1 |

---

## 13. Deployment & Operations

| ID | Edge Case | Expected Behavior | Priority |
|----|-----------|-------------------|----------|
| OPS-01 | Frontend on Vercel points to wrong API URL | Env validation at build; smoke test in CI | P0 |
| OPS-02 | Railway backend cold start — first request slow | Frontend timeout > cold start; optional warming | P1 |
| OPS-03 | Secrets missing in production env | Fail fast on startup with explicit log | P0 |
| OPS-04 | Spotify redirect URI not updated for production domain | OAuth fails 100%; document in deploy checklist | P0 |
| OPS-05 | OpenAI key shared across dev and prod | Separate keys; prod rate limits and billing alerts | P1 |
| OPS-06 | Clock skew between servers affects token expiry | Use Spotify `expires_in` with buffer (e.g. 60s early refresh) | P1 |

---

## 14. Product & Trust (Problem Statement)

These edge cases map directly to user-facing goals: relevance, discovery, explanation trust, and session adaptation.

| ID | Problem | Edge Case | Expected Behavior | Priority |
|----|---------|-----------|-------------------|----------|
| PROD-01 | Repetitive recommendations | Feed after refresh looks identical to previous batch | Change candidate search seeds; incorporate feedback; avoid same search queries | P1 |
| PROD-02 | Manual searching | AI results worse than simple Spotify search | Fallback hybrid: blend search popularity with AI rank | P1 |
| PROD-03 | Low trust | Explanation contradicts obvious facts (wrong genre label) | Validate against track/artist genres from Spotify metadata | P1 |
| PROD-04 | Low trust | High confidence on weak match | Tie confidence to explicit criteria in prompt; show "exploring" label for low confidence | P1 |
| PROD-05 | Discovery goal | All recommendations from user's top 5 artists | Enforce discovery quota in generator | P1 |
| PROD-06 | Session adaptation | User interacts for 20 min — no improvement | Regression test: context diff must change after ≥3 weighted feedback events | P1 |
| PROD-07 | Natural language intent | User describes mood without genre keywords | AI expands to search terms (tempo, instruments, similar artists) | P1 |
| PROD-08 | Fatigue | User receives 10 similar acoustic tracks in a row | Diversity constraint across batch | P1 |

---

## 15. Test Scenarios (Quick Reference)

High-value scenarios to automate or manually run before release:

```
1. New user (no history) → prompt only → non-empty explained recommendations
2. Token expiry during /generate-recommendations → silent refresh → success
3. Spotify 429 on context build → partial UI + retry
4. AI malformed JSON → retry → fallback rankings
5. Hallucinated track_id → filtered → full response count maintained
6. Like + "Vocals" chip → re-generate → explanations mention vocals
7. Skip 3 tracks in a row → re-generate → lower novelty / different artists
8. Empty search results → user-friendly empty state
9. Prompt injection string → no system leakage; safe response
10. Parallel double-click generate → single UI update; rate limit respected
```

---

## Document Links

- [Problem Statement](./problemStatement.md)
- [Architecture](./architecture.md)
- [Implementation Plan](./implementation-plan.md)
