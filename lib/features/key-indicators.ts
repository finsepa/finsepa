/** Server: Key Indicators API + cron warm (set `FINSEPA_KEY_INDICATORS=1`). */
export function stockKeyIndicatorsServerEnabled(): boolean {
  return process.env.FINSEPA_KEY_INDICATORS === "1";
}

/** Client: render card + fetch (set `NEXT_PUBLIC_FINSEPA_KEY_INDICATORS=1` at build/dev start). */
export function stockKeyIndicatorsClientEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FINSEPA_KEY_INDICATORS === "1";
}
