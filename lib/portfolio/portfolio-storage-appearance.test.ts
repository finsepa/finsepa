/**
 * Appearance merge — stale workspace PUT/hydrate must not wipe accent/icon.
 * Run: npx tsx --test lib/portfolio/portfolio-storage-appearance.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mergePersistedPortfolioAppearances,
  mergePortfolioEntriesPreservingAppearance,
  parsePersistedPortfolioUnknown,
  withMergedPortfolioAppearances,
} from "@/lib/portfolio/portfolio-storage";

function baseState(portfolios: unknown[]) {
  return parsePersistedPortfolioUnknown({
    v: 1,
    portfolios,
    selectedPortfolioId: "p1",
    holdingsByPortfolioId: { p1: [] },
    transactionsByPortfolioId: { p1: [] },
  });
}

describe("portfolio-storage appearance merge", () => {
  it("preserves donor accent/icon when target omitted them", () => {
    const target = baseState([{ id: "p1", name: "My crypto", privacy: "private" }])!;
    const donor = baseState([
      {
        id: "p1",
        name: "My crypto",
        privacy: "private",
        accentColor: "#2563EB",
        iconId: "crypto",
      },
    ])!;
    const merged = mergePortfolioEntriesPreservingAppearance(target.portfolios, donor.portfolios);
    assert.equal(merged[0]!.accentColor, "#2563EB");
    assert.equal(merged[0]!.iconId, "crypto");
  });

  it("does not override an incoming custom appearance", () => {
    const target = baseState([
      {
        id: "p1",
        name: "My crypto",
        privacy: "private",
        accentColor: "#F43F5E",
        iconId: "rocket",
      },
    ])!;
    const donor = baseState([
      {
        id: "p1",
        name: "My crypto",
        privacy: "private",
        accentColor: "#2563EB",
        iconId: "crypto",
      },
    ])!;
    const merged = mergePortfolioEntriesPreservingAppearance(target.portfolios, donor.portfolios);
    assert.equal(merged[0]!.accentColor, "#F43F5E");
    assert.equal(merged[0]!.iconId, "rocket");
  });

  it("does not paste appearance onto brokerage / combined / demo", () => {
    const donor = baseState([
      {
        id: "p1",
        name: "Broker",
        privacy: "private",
        accentColor: "#2563EB",
        iconId: "crypto",
        snaptrade: { authorizationId: "auth", accountIds: [], syncedAt: "2024-01-01T00:00:00.000Z" },
      },
    ])!;
    // Donor normalize strips appearance on brokerage — use a manual donor + brokerage target.
    const manualDonor = baseState([
      {
        id: "p1",
        name: "Manual",
        privacy: "private",
        accentColor: "#2563EB",
        iconId: "crypto",
      },
    ])!;
    const brokerageTarget = baseState([
      {
        id: "p1",
        name: "Broker",
        privacy: "private",
        snaptrade: { authorizationId: "auth", accountIds: [], syncedAt: "2024-01-01T00:00:00.000Z" },
      },
    ])!;
    const merged = mergePortfolioEntriesPreservingAppearance(
      brokerageTarget.portfolios,
      manualDonor.portfolios,
    );
    assert.equal(merged[0]!.accentColor, undefined);
    assert.equal(merged[0]!.iconId, undefined);
    assert.ok(donor);
  });

  it("mergePersistedPortfolioAppearances fills remote from local", () => {
    const local = baseState([
      {
        id: "p1",
        name: "My crypto",
        privacy: "private",
        accentColor: "#2563EB",
        iconId: "crypto",
      },
    ])!;
    const remote = baseState([{ id: "p1", name: "My crypto", privacy: "private" }])!;
    const merged = mergePersistedPortfolioAppearances(local, remote);
    assert.equal(merged.portfolios[0]!.accentColor, "#2563EB");
    assert.equal(merged.portfolios[0]!.iconId, "crypto");
  });

  it("withMergedPortfolioAppearances backfills from existing cloud row", () => {
    const incoming = baseState([{ id: "p1", name: "My crypto", privacy: "private" }])!;
    const existing = baseState([
      {
        id: "p1",
        name: "My crypto",
        privacy: "private",
        accentColor: "#16A34A",
        iconId: "coins",
      },
    ])!;
    const merged = withMergedPortfolioAppearances(incoming, existing);
    assert.equal(merged.portfolios[0]!.accentColor, "#16A34A");
    assert.equal(merged.portfolios[0]!.iconId, "coins");
  });
});
