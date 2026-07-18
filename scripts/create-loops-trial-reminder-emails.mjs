#!/usr/bin/env node
/**
 * Create Loops transactional **drafts** for trial reminder emails (does not publish).
 *
 * 1. Trial ends tomorrow → CTA to Billing (/account?tab=billing)
 * 2. Trial expired today → CTA to paywall (/activate-subscription)
 *
 *   node --env-file=.env.local scripts/create-loops-trial-reminder-emails.mjs
 *   node --env-file=.env.local scripts/create-loops-trial-reminder-emails.mjs --dry-run
 *
 *   node --env-file=.env.local scripts/create-loops-trial-reminder-emails.mjs --publish --test-email you@gmail.com
 */

const LOOPS_BASE = "https://app.loops.so/api/v1";
const DEFAULT_GROUP_ID = "cm2u88vy600nejd26m8s14h2d";

const SHARED_STYLE = `<Style backgroundColor="" backgroundXPadding="0" backgroundYPadding="0" bodyColor="" bodyXPadding="0" bodyYPadding="0" bodyFontFamily="Default" bodyFontCategory="sans-serif" borderColor="" borderWidth="0" borderRadius="4" buttonBodyColor="" buttonBodyXPadding="16" buttonBodyYPadding="12" buttonBorderColor="" buttonBorderWidth="0" buttonBorderRadius="4" buttonTextColor="" buttonTextFormat="0" buttonTextFontSize="16" dividerColor="" dividerBorderWidth="1" textBaseColor="" textBaseFontSize="14" textBaseLineHeight="150" textBaseLetterSpacing="0" textLinkColor="" heading1Color="" heading1FontSize="28" heading1LineHeight="125" heading1LetterSpacing="0" heading2Color="" heading2FontSize="24" heading2LineHeight="125" heading2LetterSpacing="0" heading3Color="" heading3FontSize="20" heading3LineHeight="125" heading3LetterSpacing="0" />`;

const DISCLAIMER = `<Paragraph fontSize="12"><Text textColor="#A1A1AA">Finsepa provides tools for research and portfolio tracking. We do not provide investment advice.</Text></Paragraph>`;

const BUTTON = (href, label) =>
  `<Button href="${href}" bgColor="#0F0F0F" borderRadius="10" innerYPadding="10" paddingTop="0" paddingBottom="0">${label}</Button>`;

const TEMPLATES = [
  {
    name: "Trial ends tomorrow",
    subject: "Your Finsepa trial ends tomorrow",
    previewText: "Upgrade to Pro to keep full access to Finsepa.",
    dataVariables: ["firstName", "trialEndsAt", "billingLink"],
    lmx: [
      SHARED_STYLE,
      `<Paragraph>Hi {data.firstName},</Paragraph>`,
      `<Paragraph></Paragraph>`,
      `<Paragraph fontSize="14">Your free trial ends tomorrow ({data.trialEndsAt}).</Paragraph>`,
      `<Paragraph></Paragraph>`,
      `<Paragraph fontSize="14">Upgrade now to continue using Finsepa without interruption — portfolios, market data, and research tools stay available on Pro.</Paragraph>`,
      `<Paragraph></Paragraph>`,
      BUTTON("{data.billingLink}", "Upgrade to Pro"),
      `<Paragraph></Paragraph>`,
      `<Paragraph>— Finsepa</Paragraph>`,
      `<Paragraph></Paragraph>`,
      DISCLAIMER,
      `<Paragraph></Paragraph>`,
    ].join("\n"),
  },
  {
    name: "Trial expired",
    subject: "Your Finsepa trial has ended",
    previewText: "Upgrade to Pro to unlock Finsepa again.",
    dataVariables: ["firstName", "upgradeLink"],
    lmx: [
      SHARED_STYLE,
      `<Paragraph>Hi {data.firstName},</Paragraph>`,
      `<Paragraph></Paragraph>`,
      `<Paragraph fontSize="14">Your free trial has ended and platform access is now locked.</Paragraph>`,
      `<Paragraph></Paragraph>`,
      `<Paragraph fontSize="14">Upgrade to Finsepa Pro to continue using portfolios, research, and market data.</Paragraph>`,
      `<Paragraph></Paragraph>`,
      BUTTON("{data.upgradeLink}", "Upgrade now"),
      `<Paragraph></Paragraph>`,
      `<Paragraph>— Finsepa</Paragraph>`,
      `<Paragraph></Paragraph>`,
      DISCLAIMER,
      `<Paragraph></Paragraph>`,
    ].join("\n"),
  },
];

const dryRun = process.argv.includes("--dry-run");
const apiKey = process.env.LOOPS_API_KEY?.trim();

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

async function findExistingByName(name) {
  const listed = await loops("/transactional-emails?perPage=50");
  return listed.data?.find((row) => row.name === name) ?? null;
}

async function upsertDraft(template) {
  let tx = await findExistingByName(template.name);
  if (tx) {
    console.log(`Found existing "${template.name}" (${tx.id}) — updating draft only.`);
    if (!tx.draftEmailMessageId) {
      await loops(`/transactional-emails/${tx.id}/ensure-draft`, { method: "POST" });
      tx = await loops(`/transactional-emails/${tx.id}`);
    }
  } else {
    console.log(`Creating "${template.name}"…`);
    if (dryRun) {
      console.log("(dry-run) would create transactional + draft.");
      return { id: "(dry-run)", draftEmailMessageId: "(dry-run)" };
    }
    tx = await loops("/transactional-emails", {
      method: "POST",
      body: {
        name: template.name,
        transactionalGroupId: DEFAULT_GROUP_ID,
      },
    });
    console.log(`  Created ${tx.id}`);
  }

  if (dryRun) return tx;

  const draftId = tx.draftEmailMessageId;
  const revisionId = tx.draftEmailMessageContentRevisionId;
  if (!draftId || !revisionId) {
    throw new Error(`Missing draft ids for ${template.name}`);
  }

  const draft = await loops(`/email-messages/${draftId}`);
  const updated = await loops(`/email-messages/${draftId}`, {
    method: "POST",
    body: {
      expectedRevisionId: draft.contentRevisionId ?? revisionId,
      subject: template.subject,
      previewText: template.previewText,
      fromName: "Finsepa",
      fromEmail: "hi",
      replyToEmail: "hi@finsepa.com",
      emailFormat: "styled",
      lmx: template.lmx,
    },
  });

  console.log(`  Draft updated (${updated.contentRevisionId})`);
  console.log(`  Variables: ${template.dataVariables.join(", ")}`);
  console.log(`  Loops editor: https://app.loops.so/transactional-emails/${tx.id}`);
  return tx;
}

(async () => {
  console.log("Creating trial reminder transactional drafts in Loops (not publishing).\n");

  const results = [];
  for (const template of TEMPLATES) {
    console.log(`--- ${template.name} ---`);
    const tx = await upsertDraft(template);
    results.push({ ...template, id: tx.id });
    console.log("");
  }

  console.log("=== Summary (save these IDs for .env when ready) ===");
  for (const r of results) {
    console.log(`${r.name}: ${r.id}`);
    console.log(`  LOOPS env suggestion:`);
    if (r.name === "Trial ends tomorrow") {
      console.log(`  LOOPS_TRANSACTIONAL_ID_TRIAL_ENDS_TOMORROW=${r.id}`);
    } else {
      console.log(`  LOOPS_TRANSACTIONAL_ID_TRIAL_EXPIRED=${r.id}`);
    }
  }

  console.log(`
Next steps:
1. Open each link above in Loops → preview the draft.
2. Reply when copy/design looks good — we'll publish and wire the cron/send logic.
3. Sample data for preview in Loops:
   - Trial ends tomorrow: firstName, trialEndsAt, billingLink = https://app.finsepa.com/account?tab=billing
   - Trial expired: firstName, upgradeLink = https://app.finsepa.com/activate-subscription
`);
})();
