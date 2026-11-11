import { notFound } from "next/navigation";

import { CRYPTO_SCREENER_ALL } from "@/lib/market/crypto-meta";
import { logoDevCryptoLogoUrl } from "@/lib/screener/company-logo-url";
import { resolveEquityLogoUrlFromTicker } from "@/lib/screener/resolve-equity-logo-url";
import { getTop500Universe } from "@/lib/screener/top500-companies";

export const dynamic = "force-dynamic";

const STOCK_COUNT = 150;
const CRYPTO_COUNT = 40;

function withParam(url: string, key: string, value: string): string {
  const u = new URL(url, "https://finsepa.local");
  u.searchParams.set(key, value);
  return `${u.pathname}?${u.searchParams.toString()}`;
}

function LogoCell({ src, dark, tile }: { src: string; dark: boolean; tile: boolean }) {
  return (
    <div
      className="flex h-14 w-14 items-center justify-center"
      style={{ background: dark ? "#141414" : "#ffffff" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- dev review grid */}
      <img
        src={src}
        alt=""
        width={36}
        height={36}
        loading="lazy"
        className="h-9 w-9 rounded-full"
        style={{
          objectFit: tile ? "cover" : "contain",
          border: tile ? "none" : `1px solid ${dark ? "#2a2a2a" : "#e5e7eb"}`,
          background: tile ? "transparent" : dark ? "#1c1c1e" : "#fff",
        }}
      />
    </div>
  );
}

/**
 * Localhost review grid: current logos vs uniform tiles, light + dark. Hidden in production unless
 * `FINSEPA_DEV_TOOLS=1` (local `next start`).
 */
export default async function LogoReviewPage() {
  if (process.env.NODE_ENV === "production" && process.env.FINSEPA_DEV_TOOLS !== "1") notFound();

  const stocks = (await getTop500Universe()).slice(0, STOCK_COUNT).map((r) => ({
    symbol: r.ticker,
    name: r.name,
    url: resolveEquityLogoUrlFromTicker(r.ticker),
  }));
  const crypto = CRYPTO_SCREENER_ALL.slice(0, CRYPTO_COUNT).map((m) => ({
    symbol: m.symbol,
    name: m.name,
    url: logoDevCryptoLogoUrl(m.symbol) ?? "",
  }));
  const rows = [...stocks, ...crypto].filter((r) => r.url.startsWith("/api/media/logo"));

  return (
    <main className="min-h-screen bg-neutral-100 p-6 text-[12px] text-neutral-800">
      <h1 className="mb-1 text-lg font-semibold">Logo review — {rows.length} assets</h1>
      <p className="mb-4 text-neutral-500">Raw Logo.dev (light · dark) vs uniform tile (light · dark).</p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-2">
        {rows.map((r) => (
          <div key={r.symbol} className="flex items-center gap-2 rounded-md bg-white p-1 pr-2 shadow-sm">
            <LogoCell src={withParam(withParam(r.url, "raw", "1"), "theme", "light")} dark={false} tile={false} />
            <LogoCell src={withParam(withParam(r.url, "raw", "1"), "theme", "dark")} dark tile={false} />
            <LogoCell src={r.url} dark={false} tile />
            <LogoCell src={r.url} dark tile />
            <div className="min-w-0">
              <div className="font-semibold">{r.symbol}</div>
              <div className="truncate text-neutral-500">{r.name}</div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
