# Finsepa platform approach (north star)

Companion to [eodhd-scaling-goal.md](./eodhd-scaling-goal.md). Agent skill:
`.claude/skills/finsepa-platform-approach/SKILL.md`.

## Approach

1. **Scale** the platform for **≈500–1,000 DAU**.
2. **Position** UX and responsiveness like **Google Finance / Yahoo Finance**.
3. Stay **efficient with EODHD** API calls (non-enterprise plan; target ≤80k–100k calls/day at 1k DAU).
4. Keep pages **fast to load**—shared snapshots and cron, not per-visitor provider fan-out.

## Constraints

We are a **smaller company**: we do **not** have an S&P 500 enterprise data feed and are **not** on an enterprise EODHD plan yet. Architecture must assume capped provider spend and curated universes (TOP10 / screener pages), not unlimited live data for every symbol.

docs/finsepa-platform-approach.md
---
## Cache tradeoff (why “local good / prod empty” happens)

To hit the budget and Yahoo-like speed, prod **freezes** market hubs when the US session is closed and serves Supabase `market_snapshot` rows. If a cron write is **partially empty** (e.g. only some crypto prices filled), that blob can stick all weekend until usability checks reject it or the next live session refreshes. Local often refetches EODHD and looks fine. Fix class: treat incomplete hubs as cache misses—not “turn off caching.”

**Client layer:** Screener market-tab payloads are also cached in `sessionStorage` keyed by the same frozen segment. A poisoned paint can stick in the browser even after Supabase is repaired (movers API looks fine; main table stays empty). Bump the client LRU key and reject sparse crypto rows on read/write.
