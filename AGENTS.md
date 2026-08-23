<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Platform approach (market data)

North star: scale for ≈500–1,000 DAU; UX/speed like Google/Yahoo Finance; minimize EODHD calls on a non-enterprise plan (no S&P enterprise feed yet); prefer cron + `market_snapshot` over per-visitor provider fan-out.

- Skill: `.claude/skills/finsepa-platform-approach/SKILL.md`
- Docs: `docs/finsepa-platform-approach.md`, `docs/eodhd-scaling-goal.md`
