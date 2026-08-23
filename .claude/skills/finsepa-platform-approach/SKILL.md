---
name: finsepa-platform-approach
description: >-
  Finsepa product/engineering north star: scale for ~500–1,000 DAU, UX like
  Google/Yahoo Finance, minimize EODHD API spend, keep list and asset pages
  fast—while on a non-enterprise market-data plan (no S&P feed). Use when
  designing caching, cron/snapshots, screener/heatmap/portfolio data paths,
  EODHD usage, performance tradeoffs, or explaining prod vs local cache
  behavior.
---

# Finsepa platform approach

North-star constraints for market data, caching, and UX. Prefer this over
“refetch everything on every page view” or enterprise-only provider features.

## Goals (in order of intent)

1. **Scale** — Support **≈500–1,000 DAU** on the current stack (Next.js +
   Supabase + EODHD), without per-user EODHD fan-out on list pages.
2. **Positioning** — Feel like **Google Finance / Yahoo Finance**: fast first
   paint, familiar screener/asset UX, shared market snapshots so refreshes
   don’t hammer the provider.
3. **EODHD efficiency** — Stay under the **non-enterprise** daily call budget
   (target **≤80k–100k** traced HTTP calls/day at 1k DAU). Cron +
   `market_snapshot` absorb most list/heatmap/watchlist cost; user traffic
   should mostly **read** snapshots.
4. **Performance** — List and asset pages should load **fast** (snapshot hit /
   single-flight cold miss), not “correct but slow because we called EODHD
   N× per visitor.”

## Hard constraints (today)

- We are a **smaller company**: **no S&P 500 enterprise feed**, **not on an
  enterprise EODHD plan yet**.
- Do **not** design features that assume unlimited provider QPS, full tick
  history everywhere, or vendor-grade real-time for the whole universe.
- Prefer **curated TOP10 / screener slices**, **batched realtime**, **EOD
  derived metrics**, and **weekend/frozen segments** over live-everything.

## How we achieve it (patterns already in the repo)

| Pattern | Why |
|---------|-----|
| Cron → `market_snapshot` hubs (`crypto_tab`, `crypto_derived`, stocks, indices, …) | One shared blob; 500 users don’t ×500 EODHD |
| Hot vs slow segments; **frozen** when US session closed | Avoid burning calls overnight/weekend |
| Per-asset / per-crypto page snapshots | Cold once, warm thereafter |
| `isUsable*` on cache hits | Partial/empty blobs must not stick as “valid” |
| Single-flight rebuild leases | Concurrent cold misses → one provider fan-out |
| Defer live quotes on list/hub routes | Portfolio/screener don’t poll every holding on paint |

Operational detail and phases: `docs/eodhd-scaling-goal.md`.
Provider call maps: `docs/FINSEPA-PROVIDER-REUSE-MATRIX-v3.md` (and related audits).

## Decision rules for agents

When changing market data / caching / screener / asset pages:

1. **User path first reads snapshot** (or session cache). EODHD on the request
   path only for cold miss, live allowlists, or explicit user actions.
2. **Never treat “object exists” as usable.** Require real prices/metrics
   (majority of TOP10 / sparkline / returns)—same class of bug as empty
   `crypto_derived_*` rows or partial `crypto_tab` hubs.
3. **Cron may skip when frozen segment is fresh**—that is intentional for
   budget. Consequence: a **bad weekend write sticks** until usability
   reject + rebuild or next live session. Document that when debugging
   “local OK, prod dashes.”
4. **Local ≠ prod.** Local often misses or bypasses poisoned hubs and hits
   EODHD; prod prefers frozen snapshots. Prefer inspecting Supabase
   `market_snapshot` over assuming a code regression.
5. **New features** must estimate EODHD cost at 1k DAU; if list-page cost
   grows with DAU, move work to cron/snapshot.

## Explicit non-goals (for now)

- Matching Bloomberg / FactSet depth or enterprise entitlements.
- Live quotes for every crypto/stock on every screener paint.
- Invalidating the whole weekend freeze on every bad symbol (prefer
  usability gates + targeted rebuild).

## Related

- `docs/eodhd-scaling-goal.md` — budget, cron, probe, phases
- `.claude/skills/supabase/` — when touching snapshot storage / RLS
