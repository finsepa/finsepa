#!/usr/bin/env node
/**
 * Smoke-test Loops transactional emails: Pro activated + Pro renewed.
 * Sends real emails via Loops (same payload shape as the Stripe webhook).
 *
 * Usage:
 *   node --env-file=.env.local scripts/test-loops-pro-emails.mjs you@example.com
 *
 * Env: LOOPS_API_KEY (required). Optional overrides:
 *   LOOPS_TRANSACTIONAL_ID_PRO_ACTIVATED, LOOPS_TRANSACTIONAL_ID_PRO_RENEWED
 *
 * @see https://loops.so/docs/api-reference/send-transactional-email
 */

const LOOPS_URL = "https://app.loops.so/api/v1/transactional";

/** Keep in sync with defaults in `lib/env/server.ts`. */
const DEFAULT_ACTIVATED = "cm0o8ezzr0qrb0i2mhrw29zlx";
const DEFAULT_RENEWED = "cm0o8r6n40k7y0izkctvh3nvq";

function loopsApiKey() {
  const a = process.env.LOOPS_API_KEY?.trim();
  if (a) return a;
  return process.env.LOOP_API_KEY?.trim();
}

async function sendTransactional(apiKey, transactionalId, email, label) {
  const res = await fetch(LOOPS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transactionalId,
      email,
      addContact: true,
    }),
  });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    /* ignore */
  }
  const success = res.ok && json.success !== false;
  const detail =
    (typeof json.message === "string" && json.message) ||
    (json.error && typeof json.error === "object" && typeof json.error.message === "string"
      ? json.error.message
      : "") ||
    text.slice(0, 400);
  if (success) {
    console.log(`✓ ${label}: sent (${res.status})`);
  } else {
    console.error(`✗ ${label}: failed (${res.status})`, detail || text.slice(0, 400));
  }
  return success;
}

const email = process.argv[2]?.trim();
const apiKey = loopsApiKey();

if (!email) {
  console.error("Usage: node --env-file=.env.local scripts/test-loops-pro-emails.mjs <email>");
  process.exit(1);
}
if (!apiKey) {
  console.error("Missing LOOPS_API_KEY (set in .env.local or export it).");
  process.exit(1);
}

const activatedId = process.env.LOOPS_TRANSACTIONAL_ID_PRO_ACTIVATED?.trim() || DEFAULT_ACTIVATED;
const renewedId = process.env.LOOPS_TRANSACTIONAL_ID_PRO_RENEWED?.trim() || DEFAULT_RENEWED;

(async () => {
  console.log(`Loops API → ${email}`);
  console.log(`  Pro activated id: ${activatedId}`);
  console.log(`  Pro renewed id:   ${renewedId}\n`);

  const okActivated = await sendTransactional(apiKey, activatedId, email, "Pro activated");
  const okRenewed = await sendTransactional(apiKey, renewedId, email, "Pro renewed");

  process.exit(okActivated && okRenewed ? 0 : 1);
})();
