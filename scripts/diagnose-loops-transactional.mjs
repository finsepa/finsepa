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
  // Common mistake: digit 0 instead of letter o after "cm" (Loops Pro templates use "cmoo…").
  if (/^cm0o/i.test(id)) {
    console.warn(
      `\n⚠ ${label} id starts with "cm0o" (digit zero) — Finsepa Pro templates in Loops use "cmoo…" (letter o). Compare with Loops → Transactional → API details.\n`,
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
      addContact: false,
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

const DEFAULT_ACTIVATED = "cmoo8ezzr0qrb0i2mhrw29zlx";
const DEFAULT_RENEWED = "cmoo8r6n40k7y0izkctvh3nvq";

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
1. Loops → Settings → Domains: sending subdomain verified (SPF/DKIM/MX/DMARC). Use mail.yourdomain.com; DKIM CNAMEs must NOT be Cloudflare-proxied.
2. Every template From address uses that verified domain (e.g. Finsepa <hello@mail.finsepa.com>). Mismatch → spam.
3. Supabase Auth SMTP uses the same Loops domain (smtp.loops.so + same API key), not a different From.
4. NEXT_PUBLIC_APP_ORIGIN=https://app.finsepa.com in Vercel — confirmation links must not be http://localhost.
5. mail-tester.com: send one test, fix DNS/content until score 9+/10.
6. Loops → transactional → Metrics: delivered vs bounced. Template Published.
7. Recipient: Spam/Promotions/All Mail. Test @gmail.com (not only Workspace). Workspace admin can quarantine external mail.
8. Loops test domains (@example.com) return success but do not deliver.
`);
})();
