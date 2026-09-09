/**
 * Eligibility for the US 8-K + 10-Q/10-K Reports warmer.
 * Does not change matcher rules. Foreign 6-K/20-F/40-F issuers stay empty.
 */

export type SecEarningsUsFilerSignals = {
  ticker: string;
  name?: string | null;
  /** EODHD `General.Type` or exchange-symbol-list Type. */
  type?: string | null;
  countryIso?: string | null;
};

/**
 * Exchange-listed FPIs / ADRs observed not to file 10-Q/10-K (6-K / 20-F / 40-F).
 * Includes the top-100 dry-run zeros plus other large-cap US-listed foreign issuers.
 * US 10-K filers incorporated abroad (LIN, ACN, MDT, ETN, CRM, …) are intentionally absent.
 */
export const SEC_REPORTS_FOREIGN_ISSUER_TICKERS: ReadonlySet<string> = new Set([
  "TSM",
  "ASML",
  "TCEHY",
  "HSBC",
  "QH",
  "RHHVF",
  "RHHBF",
  "RHHBY",
  "CYATY",
  "CICHY",
  "PCCYF",
  "NVS",
  "RCIT",
  "ACGBY",
  "RY",
  "BABA",
  "ACGBF",
  "MUFG",
  "ARM",
  "SHEL",
  "AZN",
  "BACHY",
  "SAP",
  "NSRGY",
  "BACHF",
  "LVMHF",
  "SIEGY",
  "LVMUY",
  "SMAWF",
  "LRLCY",
  "TM",
  "LRLCF",
  "BHP",
  "SAN",
  "BCDRF",
  "CBAUF",
  "IDEXF",
  "IDEXY",
  "RTNTF",
  "NVO",
  "KXIAY",
  "SFTBY",
  "MFG",
  "NWG",
  "IMO",
  "CVE",
  "CNQ",
  "BN",
  "BAM",
  "RACE",
  "CCEP",
  "HLN",
  "FMX",
  "FER",
  "ALC",
  "TECK",
  "QSR",
  "AU",
  "WDS",
  "CCJ",
  "FNV",
  "WPM",
  "KGC",
  "PBR",
  "SPCX",
  "BRK-A",
  "BAP",
  "BIP",
  "FTS",
  "PBA",
  "CPNG",
  "CIB",
  "BCH",
  "PAAS",
  "STLA",
  "YPF",
  "BEKE",
  "MGA",
  "FLUT",
  "BSAC",
  "ZTO",
  "GFL",
  "AGI",
  "RBA",
  "EMA",
  "GIB",
  "YUMC",
  "LTM",
  "BEP",
  "UL",
  "BUD",
  "BP",
  "GSK",
  "SNY",
  "DEO",
  "RIO",
  "HMC",
  "SONY",
  "INFY",
  "UBS",
  "DB",
  "BCS",
  "LYG",
  "BBVA",
  "ING",
  "NGG",
  "RELX",
  "TAK",
  "NMR",
  "SMFG",
  "HDB",
  "IBN",
  "PDD",
  "BIDU",
  "JD",
  "NTES",
  "TCOM",
  "LI",
  "NIO",
  "XPEV",
  "GRAB",
  "SE",
  "SHOP",
  "TD",
  "BNS",
  "BMO",
  "CM",
  "CNI",
  "CP",
  "SU",
  "ENB",
  "TRP",
  "GOLD",
  "AEM",
  "NTR",
  "MFC",
  "SLF",
  "WCN",
  "TRI",
  "BCE",
  "TU",
  "RCI",
  "NICE",
  "MELI",
  "NU",
  "VALE",
  "PBR",
  "ITUB",
  "BBD",
  "ABEV",
  "ASX",
  "UMC",
  "PKX",
  "KB",
  "SHG",
  "WF",
  "TLK",
  "CHT",
  "VOD",
  "BTI",
  "NGG",
  "TEF",
  "ORAN",
  "PHG",
  "ERIC",
  "NOK",
  "ABB",
  "ALIZY",
  "TOELY",
  "SNE",
  "SSNLF",
  "IDCBY",
]);

function normTicker(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/-/g, ".");
}

/**
 * Notes / preferreds / agency classes that leaked into the top-500 warm
 * because screener names omitted “Notes” / “Preferred”.
 */
export const SEC_REPORTS_STRUCTURED_TICKERS: ReadonlySet<string> = new Set([
  "TBB",
  "NCRRP",
  "NEMCL",
  "SOJE",
  "SOJC",
  "FMCCT",
  "FMCKK",
  "FREJO",
  "FREJP",
  "PLDGP",
  "DTB",
  "DTG",
  "PRS",
  "MKCV",
  "BSQKZ",
]);

function isPreferredOrStructuredSecondary(ticker: string): boolean {
  const u = ticker.trim().toUpperCase().replace(/[\u2010-\u2015]/g, "-");
  const hy = u.indexOf("-");
  if (hy >= 1) {
    const suf = u.slice(hy + 1);
    if (suf.length >= 2) return true;
    if (/^[RUW]$/.test(suf)) return true;
  }
  const dot = u.indexOf(".");
  if (dot >= 1) {
    const suf = u.slice(dot + 1);
    if (suf.length >= 2) return true;
    if (/^[RUW]$/.test(suf)) return true;
  }
  return false;
}

/**
 * NASDAQ fifth-letter structured lines: P preferred, Q bankruptcy, R rights,
 * W warrant, U unit. Leaves GOOGL / share-class *A–*O / *S–*Z alone.
 */
function isFiveLetterStructuredShareClass(ticker: string): boolean {
  const u = normTicker(ticker);
  if (u.length !== 5 || u.includes(".")) return false;
  return /[PQRWU]$/.test(u);
}

/** Pink/OTC foreign ordinary (LVMHF, NSRGF) — not BRK.B. */
function isOtcForeignOrdinaryTicker(ticker: string): boolean {
  const u = normTicker(ticker);
  if (u.endsWith("WF") && u.length > 4) return true;
  return u.length >= 4 && !u.includes(".") && u.endsWith("F") && !u.endsWith("WF");
}

/** Five-letter *Y OTC ADRs (TCEHY, BACHY). US names like ALLY / KEY stay eligible. */
function isFiveLetterOtcAdrTicker(ticker: string): boolean {
  const u = normTicker(ticker);
  return u.length === 5 && !u.includes(".") && u.endsWith("Y");
}

function typeLooksUnsupported(type: string | null | undefined): boolean {
  if (!type) return false;
  const t = type.trim().toLowerCase();
  if (!t) return false;
  if (/\badr\b|\bads\b|american depositary/.test(t)) return true;
  if (/\betf\b|\betn\b|\bfund\b|\bwarrant\b|\bunit\b|\bpreferred\b|\bnote\b|\bbond\b/.test(t)) {
    return true;
  }
  return false;
}

function nameLooksUnsupported(name: string | null | undefined): boolean {
  if (!name) return false;
  if (/\b(preferred|note|notes|debenture|bond|warrant|unit trust|depositary share|blank check|closed-end)\b/i.test(name)) {
    return true;
  }
  if (/\bacquisition\s+corp/i.test(name)) return true;
  if (/\bspac\b/i.test(name)) return true;
  return false;
}

function nameLooksAdr(name: string | null | undefined): boolean {
  if (!name) return false;
  return /\b(adr|ads|american depositary)\b/i.test(name);
}

/**
 * True when this listing is expected to file US 8-K + 10-Q/10-K.
 * Conservative: unsupported / unknown foreign lines are excluded.
 */
export function isUsSecTenQTenKIssuer(signals: SecEarningsUsFilerSignals): boolean {
  const ticker = signals.ticker.trim().toUpperCase();
  if (!ticker) return false;
  const root = ticker.split(/[-.]/)[0] ?? ticker;
  if (SEC_REPORTS_FOREIGN_ISSUER_TICKERS.has(ticker) || SEC_REPORTS_FOREIGN_ISSUER_TICKERS.has(root)) {
    return false;
  }
  if (SEC_REPORTS_STRUCTURED_TICKERS.has(ticker) || SEC_REPORTS_STRUCTURED_TICKERS.has(root)) {
    return false;
  }
  if (isPreferredOrStructuredSecondary(ticker)) return false;
  if (isOtcForeignOrdinaryTicker(ticker)) return false;
  if (isFiveLetterOtcAdrTicker(ticker)) return false;
  if (isFiveLetterStructuredShareClass(ticker)) return false;
  if (typeLooksUnsupported(signals.type)) return false;
  if (nameLooksAdr(signals.name) || nameLooksUnsupported(signals.name)) return false;
  return true;
}

export function secEarningsUsFilerSignalsFromFundamentals(
  listingTicker: string,
  root: Record<string, unknown> | null | undefined,
): SecEarningsUsFilerSignals {
  const g =
    root?.General && typeof root.General === "object" ? (root.General as Record<string, unknown>) : null;
  const type = typeof g?.Type === "string" ? g.Type : null;
  const name =
    (typeof g?.Name === "string" && g.Name) ||
    (typeof g?.FullName === "string" && g.FullName) ||
    null;
  const countryIso =
    (typeof g?.CountryISO === "string" && g.CountryISO) ||
    (typeof g?.Country === "string" && g.Country.length === 2 ? g.Country : null) ||
    null;
  return { ticker: listingTicker, name, type, countryIso };
}
