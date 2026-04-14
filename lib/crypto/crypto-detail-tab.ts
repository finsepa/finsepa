/** Crypto asset page tabs — keep in sync with `CryptoPageContent` and `app/crypto/[symbol]/page.tsx`. */

export type CryptoDetailTabId = "overview" | "holdings";

export function parseCryptoDetailTabQuery(raw: string | null | undefined): CryptoDetailTabId | null {
  if (raw === "overview" || raw === "holdings") return raw;
  return null;
}
