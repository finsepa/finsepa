/**
 * Optional request-scoped counters for Superinvestors read-path verification.
 * Disabled unless {@link beginSuperinvestorReadpathTrace} is called.
 */

export type SuperinvestorReadpathTrace = {
  listSnapshotReads: number;
  profileSnapshotReads: number;
  profileSnapshotLatestReads: number;
  secFetches: number;
  holdingsLoaderCalls: number;
};

let active = false;
let trace: SuperinvestorReadpathTrace = emptyTrace();
let fetchPatched = false;
let originalFetch: typeof globalThis.fetch | null = null;

function emptyTrace(): SuperinvestorReadpathTrace {
  return {
    listSnapshotReads: 0,
    profileSnapshotReads: 0,
    profileSnapshotLatestReads: 0,
    secFetches: 0,
    holdingsLoaderCalls: 0,
  };
}

function isSecUrl(input: RequestInfo | URL): boolean {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : typeof (input as Request).url === "string"
          ? (input as Request).url
          : "";
  return /sec\.gov/i.test(url);
}

export function beginSuperinvestorReadpathTrace(): void {
  active = true;
  trace = emptyTrace();
  if (!fetchPatched) {
    originalFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      if (active && isSecUrl(input)) trace.secFetches += 1;
      return originalFetch!(input, init);
    }) as typeof globalThis.fetch;
    fetchPatched = true;
  }
}

export function endSuperinvestorReadpathTrace(): SuperinvestorReadpathTrace {
  active = false;
  const out = { ...trace };
  trace = emptyTrace();
  return out;
}

export function traceSuperinvestorListSnapshotRead(): void {
  if (active) trace.listSnapshotReads += 1;
}

export function traceSuperinvestorProfileSnapshotRead(): void {
  if (active) trace.profileSnapshotReads += 1;
}

export function traceSuperinvestorProfileSnapshotLatestRead(): void {
  if (active) trace.profileSnapshotLatestReads += 1;
}

export function traceSuperinvestorHoldingsLoaderCall(): void {
  if (active) trace.holdingsLoaderCalls += 1;
}
