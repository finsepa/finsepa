export type SingleAssetSymbol = string;

function readFlag(): string | undefined {
  // Support both local and Next.js public env vars.
  return process.env.NEXT_PUBLIC_SINGLE_ASSET_MODE ?? process.env.SINGLE_ASSET_MODE;
}

function readSymbol(): string {
  return (
    process.env.NEXT_PUBLIC_SINGLE_ASSET_SYMBOL ??
    process.env.SINGLE_ASSET_SYMBOL ??
    "NVDA"
  ).toUpperCase();
}

/** Temporary product simplification: only one asset is supported. */
export const SINGLE_ASSET_MODE_ENABLED = readFlag() === "1" || readFlag() === "true";
export const SINGLE_ASSET_SYMBOL: SingleAssetSymbol = readSymbol();

export function isSingleAssetMode(): boolean {
  return SINGLE_ASSET_MODE_ENABLED;
}

export function isSupportedAsset(ticker: string): boolean {
  return ticker.trim().toUpperCase() === SINGLE_ASSET_SYMBOL;
}

