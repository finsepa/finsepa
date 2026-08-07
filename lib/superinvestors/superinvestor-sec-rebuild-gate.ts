/**
 * SEC rebuilds for Superinvestors are gated to cron / authenticated ops only.
 * User page and API loaders must not enter this gate.
 */

let depth = 0;
let forceDepth = 0;

/** Run `fn` with SEC freshness / rebuild allowed (cron + ops refresh paths). */
export async function withSuperinvestorSecRebuildAllowed<T>(fn: () => Promise<T>): Promise<T> {
  depth += 1;
  try {
    return await fn();
  } finally {
    depth -= 1;
  }
}

/**
 * Ops force-refresh: rebuild from SEC even when the durable snapshot accession still matches.
 * Does not delete the prior snapshot — successful upsert replaces it atomically.
 */
export async function withSuperinvestorForceSnapshotRebuild<T>(fn: () => Promise<T>): Promise<T> {
  forceDepth += 1;
  try {
    return await withSuperinvestorSecRebuildAllowed(fn);
  } finally {
    forceDepth -= 1;
  }
}

export function isSuperinvestorSecRebuildAllowed(): boolean {
  return depth > 0;
}

export function isSuperinvestorForceSnapshotRebuild(): boolean {
  return forceDepth > 0;
}
