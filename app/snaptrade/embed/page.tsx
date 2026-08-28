import { SnapTradeEmbedClient } from "./snaptrade-embed-client";

export const dynamic = "force-dynamic";

/** iOS WKWebView shell — embeds SnapTrade portal in iframe (same as web modal). */
export default function SnapTradeEmbedPage() {
  return (
    <main className="min-h-dvh bg-surface">
      <SnapTradeEmbedClient />
    </main>
  );
}
