import { NextResponse } from "next/server";

import { ingestHubSnapshots } from "@/lib/market/hub-snapshot-ingest";
import {
  forceIngestCryptoDerived,
  forceIngestCryptoHot,
  ingestMarketSnapshots,
} from "@/lib/market/market-snapshot-ingest";
import { pickProcessEnv } from "@/lib/env/pick-process-env";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorizeCron(request: Request): boolean {
  const secret = pickProcessEnv("CRON_SECRET");
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const force = url.searchParams.get("force");
    if (force === "crypto_derived") {
      const cryptoDerived = await forceIngestCryptoDerived();
      return NextResponse.json({ at: new Date().toISOString(), force, cryptoDerived });
    }
    if (force === "crypto_hot") {
      const cryptoHot = await forceIngestCryptoHot();
      return NextResponse.json({ at: new Date().toISOString(), force, cryptoHot });
    }
    if (force === "crypto_screener") {
      const [cryptoHot, cryptoDerived] = await Promise.all([
        forceIngestCryptoHot(),
        forceIngestCryptoDerived(),
      ]);
      return NextResponse.json({ at: new Date().toISOString(), force, cryptoHot, cryptoDerived });
    }

    const [market, hub] = await Promise.all([ingestMarketSnapshots(), ingestHubSnapshots()]);
    return NextResponse.json({ at: new Date().toISOString(), market, hub });
  } catch (e) {
    const message = e instanceof Error ? e.message : "ingest_failed";
    console.error("[cron/market-snapshots]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
