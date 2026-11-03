import { NextResponse } from "next/server";

import { resolveAuthUserFromRequest } from "@/lib/auth/resolve-auth-user";
import { CACHE_CONTROL_PRIVATE_NO_STORE, CACHE_CONTROL_PRIVATE_WARM } from "@/lib/data/cache-policy";
import { loadCryptoCandles } from "@/lib/market/crypto-candles";
import { isCryptoCandleInterval, type CryptoCandleInterval } from "@/lib/market/crypto-candles-shared";

type Ctx = { params: Promise<{ symbol: string }> };

const SYMBOL_RE = /^[A-Z0-9][A-Z0-9.\-]{0,23}$/;

/** GET `?interval=` — OHLC candles for the crypto overview candle view. */
export async function GET(request: Request, { params }: Ctx) {
  const user = await resolveAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const symbol = decodeURIComponent((await params).symbol).trim().toUpperCase();
  if (!SYMBOL_RE.test(symbol)) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }

  const intervalParam = new URL(request.url).searchParams.get("interval");
  const interval: CryptoCandleInterval = isCryptoCandleInterval(intervalParam) ? intervalParam : "1D";

  const payload = await loadCryptoCandles(symbol, interval);
  return NextResponse.json(payload, {
    headers: { "Cache-Control": payload.live ? CACHE_CONTROL_PRIVATE_NO_STORE : CACHE_CONTROL_PRIVATE_WARM },
  });
}
