import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clearPendingAssetShell,
  clearPendingAssetShellIfMatch,
  getPendingAssetShell,
  parseAssetPathname,
  pendingAssetShellMatchesPath,
  setPendingAssetShell,
  watchlistKindToPendingAssetKind,
} from "@/lib/navigation/pending-asset-shell";

describe("pending-asset-shell", () => {
  it("parses asset pathnames", () => {
    assert.deepEqual(parseAssetPathname("/stock/ASML"), { kind: "stock", symbol: "ASML" });
    assert.deepEqual(parseAssetPathname("/crypto/BTC"), { kind: "crypto", symbol: "BTC" });
    assert.deepEqual(parseAssetPathname("/index/GSPC.INDX"), {
      kind: "index",
      symbol: "GSPC.INDX",
    });
    assert.equal(parseAssetPathname("/screener"), null);
  });

  it("matches pending to pathname", () => {
    setPendingAssetShell({
      kind: "stock",
      symbol: "asml",
      name: "ASML Holding",
      price: 100,
      href: "/stock/ASML",
    });
    assert.equal(pendingAssetShellMatchesPath(getPendingAssetShell(), "/stock/ASML"), true);
    assert.equal(pendingAssetShellMatchesPath(getPendingAssetShell(), "/stock/INTC"), false);
    clearPendingAssetShellIfMatch("stock", "ASML");
    assert.equal(getPendingAssetShell(), null);
  });

  it("clearIfMatch ignores different symbol", () => {
    setPendingAssetShell({
      kind: "stock",
      symbol: "NVDA",
      href: "/stock/NVDA",
    });
    clearPendingAssetShellIfMatch("stock", "AAPL");
    assert.equal(getPendingAssetShell()?.symbol, "NVDA");
    clearPendingAssetShell();
  });

  it("maps watchlist forex to currency", () => {
    assert.equal(watchlistKindToPendingAssetKind("forex"), "currency");
    assert.equal(watchlistKindToPendingAssetKind("crypto"), "crypto");
  });
});
