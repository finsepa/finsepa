#!/usr/bin/env node
/**
 * Deep-check Loops transactional sends: full HTTP body + common delivery pitfalls.
 *
 * Usage:
 *   node --env-file=.env.local scripts/diagnose-loops-transactional.mjs hi@finsepa.com
 *
 * If API returns success:true but mail never arrives, delivery/DNS/workspace filtering
 * is outside this repo — follow the printed checklist and Loops → Metrics on each template.
 */

const LOOPS_URL = "https://app.loops.so/api/v1/transactional";

function loopsApiKey() {
  const a = process.env.LOOPS_API_KEY?.trim();
  if (a) return a;
  return process.env.LOOP_API_KEY?.trim();
}

function warnIdTypo(id, label) {
  if (!id || typeof id !== "string") return;
  // Common mistake: typing letter O instead of digit 0 after "cm"
  if (/^cm[oO]{2}/.test(id)) {
    console.warn(
      `\n⚠ ${label} id starts with "cmoo" — IDs are usually "cm0o…" (digit zero). Compare character-by-character with Loops → Transactional → API details.\n`,
    );
  }
}

async function postTransactional(apiKey, transactionalId, email) {
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
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { res, text, json };
}

const email = process.argv[2]?.trim();
const apiKey = loopsApiKey();

const DEFAULT_ACTIVATED = "cm0o8ezzr0qrb0i2mhrw29zlx";
const DEFAULT_RENEWED = "cm0o8r6n40k7y0izkctvh3nvq";

const activatedId = process.env.LOOPS_TRANSACTIONAL_ID_PRO_ACTIVATED?.trim() || DEFAULT_ACTIVATED;
const renewedId = process.env.LOOPS_TRANSACTIONAL_ID_PRO_RENEWED?.trim() || DEFAULT_RENEWED;

if (!email) {
  console.error("Usage: node --env-file=.env.local scripts/diagnose-loops-transactional.mjs <email>");
  process.exit(1);
}
if (!apiKey) {
  console.error("Missing LOOPS_API_KEY in environment.");
  process.exit(1);
}

warnIdTypo(activatedId, "PRO_ACTIVATED");
warnIdTypo(renewedId, "PRO_RENEWED");

(async () => {
  console.log(`Recipient: ${email}`);
  console.log(`Endpoint:  ${LOOPS_URL}\n`);

  for (const [label, tid] of [
    ["Pro activated", activatedId],
    ["Pro renewed", renewedId],
  ]) {
    console.log(`--- ${label} (${tid}) ---`);
    const { res, text, json } = await postTransactional(apiKey, tid, email);
    console.log(`HTTP ${res.status}`);
    console.log(`Body:   ${text || "(empty)"}`);
    const accepted = res.ok && json && json.success === true;
    console.log(accepted ? "API:    accepted (success:true)\n" : "API:    NOT accepted — fix API/template before debugging inbox.\n");
  }

  console.log(`--- Delivery checklist (API already accepted?) ---`);
  console.log(`
1. Loops dashboard → each transactional → Metrics / activity: delivered vs bounced vs deferred.
2. Settings → Sending domain: all DNS records verified (SPF/DKIM/MX). Unverified often yields 400 from API; if verified, still check bounces.
3. Template is Published; required data variables are provided (missing vars usually return 400).
4. Recipient inbox: Spam, Promotions, “All Mail”. Try a personal @gmail.com send — avoids Google Workspace rules on hi@finsepa.com.
5. Google Workspace: Email log search / moderation / Groups settings can block “external” copies of mail to your own domain.
6. Loops test domains: sends to @example.com / @test.com return success but deliberately do NOT deliver (per Loops docs).
`);
})();
