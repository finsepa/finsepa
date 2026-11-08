import { notFound } from "next/navigation";

import { BinanceCryptoSmokeClient } from "./binance-crypto-smoke-client";

/** Localhost visual smoke test for Binance public trade streams. Hidden in production. */
export default function BinanceCryptoDevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="min-h-screen bg-black">
      <BinanceCryptoSmokeClient />
    </main>
  );
}
