/**
 * One-shot: build daily US mcap hub (if missing) + rebuild prev/cur/next earnings weeks into market_snapshot.
 * Usage: npx tsx --env-file=.env.local scripts/rebuild-earnings-hub-weeks.ts
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require.cache[require.resolve("server-only")] = {
  id: require.resolve("server-only"),
  filename: require.resolve("server-only"),
  loaded: true,
  exports: {},
} as NodeModule;

async function main() {
  const {
    addDaysUtc,
    buildEarningsWeekHubPackage,
    earningsWeekRebuildLooksDegraded,
    mondayOfWeekUtc,
    toYmdUtc,
  } = await import("@/lib/market/earnings-week-data");
  type EarningsWeekDataPackage = import("@/lib/market/earnings-week-data").EarningsWeekDataPackage;
  const { buildUsEquityMcapSnapshotForIngest, usEquityMcapSegment } = await import(
    "@/lib/market/us-equity-mcap-universe"
  );
  const { earningsWeekHubSegment, hubEarningsWeekKey, HUB_SNAPSHOT_KEY } = await import(
    "@/lib/market/hub-snapshot-keys"
  );
  const { readHubSnapshot, upsertHubSnapshot } = await import("@/lib/market/hub-snapshot-store");

  function earningsWeekMondaysForIngest(now: Date): string[] {
    const mon = mondayOfWeekUtc(now);
    return [toYmdUtc(addDaysUtc(mon, -7)), toYmdUtc(mon), toYmdUtc(addDaysUtc(mon, 7))];
  }

  function utcMondayFromYmd(weekMondayYmd: string): Date {
    const t = Date.parse(`${weekMondayYmd}T12:00:00.000Z`);
    return Number.isFinite(t) ? mondayOfWeekUtc(new Date(t)) : mondayOfWeekUtc(new Date());
  }

  const now = new Date();
  console.log("[rebuild-earnings] start", now.toISOString());

  const mcapSeg = usEquityMcapSegment(now);
  const existingMcap = await readHubSnapshot<{ rows?: unknown[] }>(HUB_SNAPSHOT_KEY.usEquityMcap, mcapSeg, {
    allowStale: true,
    maxStaleMs: 7 * 24 * 60 * 60 * 1000,
  });
  if (existingMcap && Array.isArray(existingMcap.rows) && existingMcap.rows.length >= 1500) {
    console.log("[rebuild-earnings] mcap snapshot present", { segment: mcapSeg, rows: existingMcap.rows.length });
  } else {
    console.log("[rebuild-earnings] building mcap snapshot…");
    const snap = await buildUsEquityMcapSnapshotForIngest();
    if (!snap) {
      console.error("[rebuild-earnings] mcap build failed/incomplete — aborting week rebuilds");
      process.exit(1);
    }
    const res = await upsertHubSnapshot(HUB_SNAPSHOT_KEY.usEquityMcap, mcapSeg, snap);
    console.log("[rebuild-earnings] mcap upsert", res.ok ? "ok" : res, { rows: snap.rows.length });
    if (!res.ok) process.exit(1);
  }

  for (const weekYmd of earningsWeekMondaysForIngest(now)) {
    const key = hubEarningsWeekKey(weekYmd);
    const seg = earningsWeekHubSegment(weekYmd);
    console.log("[rebuild-earnings] building week", weekYmd);
    const t0 = Date.now();
    try {
      const pack = await buildEarningsWeekHubPackage(utcMondayFromYmd(weekYmd));
      const previous = await readHubSnapshot<EarningsWeekDataPackage>(key, seg, { allowStale: true });
      const degraded = previous ? earningsWeekRebuildLooksDegraded(previous, pack) : null;
      if (degraded) {
        console.warn("[rebuild-earnings] degraded — keeping previous", weekYmd, degraded);
        continue;
      }
      const res = await upsertHubSnapshot(key, seg, pack);
      const days = pack.payload.days.map((d) => ({
        date: d.date,
        n: (d.listItems ?? []).length,
        withEps: (d.listItems ?? []).filter((i) => i.estEpsDisplay).length,
      }));
      console.log("[rebuild-earnings] week done", {
        weekYmd,
        ms: Date.now() - t0,
        upsert: res.ok ? "ok" : res,
        hasAnyEvents: pack.payload.hasAnyEvents,
        estimatesHydrated: pack.estimatesHydrated,
        days,
      });
    } catch (e) {
      console.error("[rebuild-earnings] week failed", weekYmd, e);
      process.exitCode = 1;
    }
  }
  console.log("[rebuild-earnings] done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
