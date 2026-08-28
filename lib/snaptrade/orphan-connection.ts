export type SnaptradeConnectionRow = {
  id: string;
  createdDate?: string | null;
};

/** Latest SnapTrade authorization not linked to any portfolio workspace row. */
export function findOrphanSnaptradeConnection(
  connections: readonly SnaptradeConnectionRow[],
  linkedAuthorizationIds: ReadonlySet<string>,
): SnaptradeConnectionRow | null {
  const sorted = [...connections].sort((a, b) =>
    (b.createdDate ?? "").localeCompare(a.createdDate ?? ""),
  );
  return sorted.find((row) => row.id.trim() && !linkedAuthorizationIds.has(row.id.trim())) ?? null;
}

export function linkedSnaptradeAuthorizationIds(
  portfolios: ReadonlyArray<{ snaptrade?: { authorizationId?: string | null } | null }>,
): Set<string> {
  const ids = new Set<string>();
  for (const p of portfolios) {
    const id = p.snaptrade?.authorizationId?.trim();
    if (id && id !== "offline") ids.add(id);
  }
  return ids;
}
