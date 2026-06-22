#!/usr/bin/env node
/**
 * Create unique Stripe promotion codes for influencer 1-year Pro access.
 *
 * Coupon: 100% off Finsepa Pro for 12 months (then normal billing resumes).
 * Each promo code: single use (max_redemptions = 1).
 *
 * Usage:
 *   node --env-file=.env.local scripts/stripe-create-influencer-codes.mjs
 *   node --env-file=.env.local scripts/stripe-create-influencer-codes.mjs --count 50
 *   node --env-file=.env.local scripts/stripe-create-influencer-codes.mjs --dry-run
 *
 * Output: scripts/output/influencer-promo-codes.csv (gitignored)
 */

import { createWriteStream, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";

import Stripe from "stripe";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "output");
const OUTPUT_CSV = join(OUTPUT_DIR, "influencer-promo-codes.csv");

const FINSEPA_PRO_PRODUCT_ID = "prod_UQJCIuFh1UXkRY";
const COUPON_NAME = "Influencer 1yr Pro (100% off)";
const COUPON_METADATA_KEY = "finsepa_purpose";
const COUPON_METADATA_VALUE = "influencer-1yr-pro";
const CODE_PREFIX = "FINSEPA";

function parseArgs() {
  const args = process.argv.slice(2);
  let count = 50;
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--count" && args[i + 1]) {
      count = Math.max(1, Math.min(500, Number.parseInt(args[++i], 10) || 50));
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }
  return { count, dryRun };
}

function requireStripeKey() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY in environment.");
  return key;
}

function randomCodeSuffix(length = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

function buildUniqueCodes(count) {
  const codes = new Set();
  while (codes.size < count) {
    codes.add(`${CODE_PREFIX}-${randomCodeSuffix(8)}`);
  }
  return [...codes];
}

async function findOrCreateCoupon(stripe, dryRun) {
  const listed = await stripe.coupons.list({ limit: 100 });
  const existing = listed.data.find(
    (c) => c.metadata?.[COUPON_METADATA_KEY] === COUPON_METADATA_VALUE,
  );
  if (existing) {
    console.log(`Reusing coupon ${existing.id} (${existing.name})`);
    return existing;
  }

  const params = {
    name: COUPON_NAME,
    percent_off: 100,
    duration: "repeating",
    duration_in_months: 12,
    applies_to: { products: [FINSEPA_PRO_PRODUCT_ID] },
    metadata: {
      [COUPON_METADATA_KEY]: COUPON_METADATA_VALUE,
    },
  };

  if (dryRun) {
    console.log("[dry-run] Would create coupon:", params);
    return { id: "coupon_dry_run" };
  }

  const coupon = await stripe.coupons.create(params);
  console.log(`Created coupon ${coupon.id}`);
  return coupon;
}

async function main() {
  const { count, dryRun } = parseArgs();
  const stripe = new Stripe(requireStripeKey());
  const codes = buildUniqueCodes(count);

  console.log(`Mode: ${dryRun ? "dry-run" : "live"}`);
  console.log(`Creating ${count} single-use promotion codes…`);

  const coupon = await findOrCreateCoupon(stripe, dryRun);
  const rows = [["code", "promotion_code_id", "coupon_id", "max_redemptions", "created_at"]];

  for (const code of codes) {
    if (dryRun) {
      rows.push([code, "promo_dry_run", coupon.id, "1", new Date().toISOString()]);
      continue;
    }

    const promo = await stripe.promotionCodes.create({
      promotion: { type: "coupon", coupon: coupon.id },
      code,
      max_redemptions: 1,
      metadata: {
        [COUPON_METADATA_KEY]: COUPON_METADATA_VALUE,
      },
    });
    rows.push([code, promo.id, coupon.id, "1", new Date().toISOString()]);
    process.stdout.write(`\rCreated ${rows.length - 1}/${count}`);
  }

  if (!dryRun) process.stdout.write("\n");

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  if (!dryRun) {
    const { writeFileSync } = await import("fs");
    writeFileSync(OUTPUT_CSV, `${csv}\n`, "utf8");
    console.log(`\nSaved ${count} codes → ${OUTPUT_CSV}`);
  } else {
    console.log("\nSample codes:", codes.slice(0, 3).join(", "), "…");
  }

  console.log("\nInfluencers redeem at Finsepa checkout → Add promotion code.");
  console.log("Works on monthly or annual Pro; 12 months free, then normal price.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
