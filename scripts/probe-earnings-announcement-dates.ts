/**
 * Probe EODHD calendar vs History reportDate for WMT/COST announcement-date diagnosis.
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
  const { fetchEodhdEarningsAnnouncementCalendar } = await import(
    "../lib/market/eodhd-earnings-calendar.ts"
  );
  const { fetchEodhdFundamentalsJsonFresh } = await import("../lib/market/eodhd-fundamentals.ts");

  for (const ticker of ["COST", "WMT"]) {
    const cal = await fetchEodhdEarningsAnnouncementCalendar(`${ticker}.US`, "2022-01-01", "2026-09-08");
    console.log(`\n=== ${ticker} calendar rows=${cal.length} ===`);
    for (const r of cal.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
      console.log(`  date=${r.date} report_date=${r.report_date}`);
    }

    const root = await fetchEodhdFundamentalsJsonFresh(ticker);
    const hist = (root as { Earnings?: { History?: Record<string, Record<string, unknown>> } })?.Earnings
      ?.History;
    console.log(`\n=== ${ticker} History reportDate (first 20) ===`);
    if (hist && typeof hist === "object") {
      const keys = Object.keys(hist).sort().reverse().slice(0, 20);
      for (const k of keys) {
        const row = hist[k]!;
        console.log(
          `  ${k} date=${row.date ?? row.Date} reportDate=${row.reportDate ?? row.ReportDate ?? row.report_date}`,
        );
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
