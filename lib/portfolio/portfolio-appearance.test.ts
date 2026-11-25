/**
 * Keep web catalogs / persist rules in lockstep with iOS
 * `Core/Models/PortfolioAppearance.swift`.
 *
 * Run: npx tsx --test lib/portfolio/portfolio-appearance.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";

import { normalizePortfolioEntry } from "@/components/portfolio/portfolio-types";
import {
  DEFAULT_PORTFOLIO_ACCENT_COLOR,
  DEFAULT_PORTFOLIO_ICON_ID,
  PORTFOLIO_ACCENT_COLORS,
  PORTFOLIO_ICON_IDS,
  appearancePersistFields,
  appearanceValueFromPortfolio,
  portfolioAccentIconColor,
  portfolioHasCustomAppearance,
} from "@/lib/portfolio/portfolio-appearance";

/** iOS `PortfolioAccentColor` raw values (order + hex). */
const IOS_ACCENT_COLORS = [
  "#60A5FA",
  "#2DD4BF",
  "#C4B5FD",
  "#A78BFA",
  "#2563EB",
  "#E879F9",
  "#F43F5E",
  "#FBBF24",
  "#86EFAC",
  "#16A34A",
  "#FB923C",
  "#64748B",
] as const;

/** iOS `PortfolioIconId` cases (wire ids). */
const IOS_ICON_IDS = [
  "finsepa",
  "briefcase",
  "pie",
  "coins",
  "piggy",
  "wallet",
  "shield",
  "umbrella",
  "safe",
  "scales",
  "trendUp",
  "rocket",
  "zap",
  "target",
  "trophy",
  "hourglass",
  "home",
  "family",
  "child",
  "education",
  "heart",
  "globe",
  "building",
  "crypto",
] as const;

test("accent colors match iOS PortfolioAccentColor", () => {
  assert.deepEqual([...PORTFOLIO_ACCENT_COLORS], [...IOS_ACCENT_COLORS]);
  assert.equal(DEFAULT_PORTFOLIO_ACCENT_COLOR, "#2563EB");
});

test("icon ids match iOS PortfolioIconId", () => {
  assert.deepEqual([...PORTFOLIO_ICON_IDS], [...IOS_ICON_IDS]);
  assert.equal(DEFAULT_PORTFOLIO_ICON_ID, "finsepa");
});

test("blue + crypto persist and round-trip through normalize", () => {
  const persisted = appearancePersistFields({
    accentColor: "#2563EB",
    iconId: "crypto",
  });
  assert.deepEqual(persisted, { accentColor: "#2563EB", iconId: "crypto" });

  const entry = normalizePortfolioEntry({
    id: "p1",
    name: "My Crypto",
    privacy: "private",
    ...persisted,
  });
  assert.equal(entry.accentColor, "#2563EB");
  assert.equal(entry.iconId, "crypto");
  assert.equal(portfolioHasCustomAppearance(entry), true);

  const value = appearanceValueFromPortfolio(entry);
  assert.equal(value.accentColor, "#2563EB");
  assert.equal(value.iconId, "crypto");
});

test("classic defaults omit wire fields (theme-aware Finsepa tile)", () => {
  const persisted = appearancePersistFields({
    accentColor: null,
    iconId: "finsepa",
  });
  assert.deepEqual(persisted, {});
});

test("appearance is stripped on brokerage / combined / demo", () => {
  const brokerage = normalizePortfolioEntry({
    id: "b1",
    name: "IBKR",
    accentColor: "#2563EB",
    iconId: "crypto",
    snaptrade: {
      authorizationId: "auth-1",
      accountIds: [],
      brokerageName: "IBKR",
      brokerageSlug: "IBKR",
      brokerageLogoUrl: null,
      syncedAt: new Date().toISOString(),
    },
  });
  assert.equal(brokerage.accentColor, undefined);
  assert.equal(brokerage.iconId, undefined);

  const combined = normalizePortfolioEntry({
    id: "c1",
    name: "All",
    kind: "combined",
    combinedFrom: ["a", "b"],
    accentColor: "#2563EB",
    iconId: "crypto",
  });
  assert.equal(combined.accentColor, undefined);
  assert.equal(combined.iconId, undefined);

  const demo = normalizePortfolioEntry({
    id: "d1",
    name: "Demo",
    isDemo: true,
    accentColor: "#2563EB",
    iconId: "crypto",
  });
  assert.equal(demo.accentColor, undefined);
  assert.equal(demo.iconId, undefined);
});

test("portfolioAccentIconColor picks black on light plates", () => {
  assert.equal(portfolioAccentIconColor("#FBBF24"), "#141414");
  assert.equal(portfolioAccentIconColor("#2563EB"), "#FFFFFF");
});
