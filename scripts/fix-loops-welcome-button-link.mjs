#!/usr/bin/env node
/**
 * Fix Welcome Trial Start Loops template button href.
 *
 * Published template had: href="{{data.platformLink}" (invalid — wrong syntax + missing `}}`).
 * Correct LMX transactional syntax (matches password-reset / confirm-email): href="{data.platformLink}"
 *
 *   node --env-file=.env.local scripts/fix-loops-welcome-button-link.mjs
 *   node --env-file=.env.local scripts/fix-loops-welcome-button-link.mjs --dry-run
 *   node --env-file=.env.local scripts/fix-loops-welcome-button-link.mjs --test-email you@gmail.com
 */

const LOOPS_BASE = "https://app.loops.so/api/v1";
const DEFAULT_TX_ID = "cmpqlacpq1dux0j155z7t77cv";
const FIXED_HREF = "{data.platformLink}";

const BROKEN_PATTERNS = [
  /\{\{data\.platformLink\}\}/g,
  /\{\{data\.platformLink\}/g,
  /\{platformLink\}/g,
];

const dryRun = process.argv.includes("--dry-run");
const testEmail = process.argv.find((a, i) => process.argv[i - 1] === "--test-email")?.trim();

const apiKey = process.env.LOOPS_API_KEY?.trim();
const txId =
  process.env.LOOPS_TRANSACTIONAL_ID_WELCOME_TRIAL_START?.trim() ||
  process.env.LOOPS_TRANSACTIONAL_ID_GOOGLE_WELCOME?.trim() ||
  DEFAULT_TX_ID;

if (!apiKey) {
  console.error("Missing LOOPS_API_KEY (use --env-file=.env.local).");
  process.exit(1);
}

async function loops(path, { method = "GET", body } = {}) {
  const res = await fetch(`${LOOPS_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg = json?.message ?? text?.slice(0, 300) ?? `HTTP ${res.status}`;
    throw new Error(`${method} ${path} → ${res.status}: ${msg}`);
  }
  return json;
}

function fixLmx(lmx) {
  if (!lmx || typeof lmx !== "string") {
    return { lmx, changed: false, reason: "empty" };
  }

  let next = lmx;
  let changed = false;

  if (next.includes('align="start"')) {
    next = next.replace(/align="start"/g, 'align="left"');
    changed = true;
  }

  for (const pattern of BROKEN_PATTERNS) {
    if (pattern.test(next)) {
      next = next.replace(pattern, FIXED_HREF);
      changed = true;
    }
  }

  // Draft sometimes loses href entirely — inject on the welcome button.
  const buttonNoHref =
    /<Button(?![^>]*\bhref=)([^>]*bgColor="#09090B"[^>]*)>/;
  if (buttonNoHref.test(next) && !next.includes(FIXED_HREF)) {
    next = next.replace(buttonNoHref, `<Button href="${FIXED_HREF}"$1>`);
    changed = true;
  }

  if (next.includes(FIXED_HREF) && !changed) {
    return { lmx: next, changed: false, alreadyFixed: true };
  }

  return { lmx: next, changed };
}

(async () => {
  console.log(`Transactional id: ${txId}`);
  if (dryRun) console.log("(dry-run — no draft update or publish)\n");

  const listed = await loops("/transactional-emails?perPage=50");
  const tx =
    listed.data?.find((r) => r.id === txId) ??
    listed.data?.find((r) => /welcome/i.test(r.name ?? ""));
  if (!tx) {
    console.error("Welcome transactional not found in Loops account.");
    process.exit(1);
  }

  console.log(`Template: "${tx.name}" (${tx.id})`);

  const sourceId = tx.publishedEmailMessageId ?? tx.draftEmailMessageId;
  const draftId = tx.draftEmailMessageId;
  if (!sourceId || !draftId) {
    console.error("Missing published or draft email message id.", tx);
    process.exit(1);
  }

  const [published, draft] = await Promise.all([
    loops(`/email-messages/${sourceId}`),
    loops(`/email-messages/${draftId}`),
  ]);

  // Prefer published body (complete) when draft button href is missing.
  const baseLmx =
    (published.lmx?.includes("platformLink") || published.lmx?.includes("Go to Finsepa"))
      ? published.lmx
      : draft.lmx || published.lmx;

  const { lmx: fixedLmx, changed, alreadyFixed, reason } = fixLmx(baseLmx);

  const beforeBtn = baseLmx.match(/<Button[^>]*>/)?.[0];
  const afterBtn = fixedLmx.match(/<Button[^>]*>/)?.[0];
  console.log("Before:", beforeBtn ?? "(no button tag)");
  console.log("After: ", afterBtn ?? "(no button tag)");

  if (alreadyFixed) {
    console.log("\nAlready fixed. Publishing skipped.");
  } else if (!changed) {
    console.warn("\nNo changes applied.", reason ?? "");
    process.exit(1);
  } else if (dryRun) {
    console.log("\n(dry-run) Would update draft and publish.");
  } else {
    const updated = await loops(`/email-messages/${draftId}`, {
      method: "POST",
      body: {
        expectedRevisionId: draft.contentRevisionId,
        subject: draft.subject ?? published.subject,
        previewText: draft.previewText ?? published.previewText,
        fromName: draft.fromName ?? published.fromName,
        fromEmail: draft.fromEmail ?? published.fromEmail,
        replyToEmail: draft.replyToEmail ?? published.replyToEmail ?? "",
        lmx: fixedLmx,
      },
    });
    console.log("Draft updated. Revision:", updated.contentRevisionId);

    await loops(`/transactional-emails/${tx.id}/publish`, { method: "POST" });
    console.log("Published.");
  }

  if (testEmail && !dryRun) {
    const appOrigin =
      process.env.NEXT_PUBLIC_APP_ORIGIN?.trim().replace(/\/$/, "") ||
      "https://app.finsepa.com";
    const trialEnds = new Date();
    trialEnds.setUTCDate(trialEnds.getUTCDate() + 7);
    const trialEndsAt = trialEnds.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
    await loops("/transactional", {
      method: "POST",
      body: {
        transactionalId: tx.id,
        email: testEmail,
        dataVariables: {
          firstName: "Test",
          platformLink: `${appOrigin}/screener`,
          confirmationLink: `${appOrigin}/screener`,
          trialDays: 7,
          trialEndsAt,
          proInfoLine:
            "Your free trial includes full platform access for 7 days. Upgrade to Finsepa Pro anytime for ongoing research tools, portfolio tracking, and market data.",
        },
      },
    });
    console.log("Test email sent to", testEmail);
  }

  console.log("\nDone — button should link to https://app.finsepa.com/screener");
})();
