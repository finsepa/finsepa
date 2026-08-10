#!/usr/bin/env node
/**
 * Create + publish Loops transactional for email login OTP (MoonPay-style code).
 *
 *   node --env-file=.env.local scripts/create-loops-email-otp.mjs
 *   node --env-file=.env.local scripts/create-loops-email-otp.mjs --dry-run
 *   node --env-file=.env.local scripts/create-loops-email-otp.mjs --test-email you@gmail.com
 */

const LOOPS_BASE = "https://app.loops.so/api/v1";
const DEFAULT_GROUP_ID = "cm2u88vy600nejd26m8s14h2d";
const NAME = "Email login code";

// Leave body/background colors empty so Loops can auto-adapt light vs dark.
// Code box: light grey + black digits (MoonPay-style) for light theme; reads as a
// light card on dark mail backgrounds too (LMX has no dual theme tokens).
const SHARED_STYLE = `<Style backgroundColor="" backgroundXPadding="0" backgroundYPadding="28" bodyColor="" bodyXPadding="0" bodyYPadding="28" bodyFontFamily="Default" bodyFontCategory="sans-serif" borderColor="" borderWidth="0" borderRadius="4" buttonBodyColor="" buttonBodyXPadding="16" buttonBodyYPadding="12" buttonBorderColor="" buttonBorderWidth="0" buttonBorderRadius="4" buttonTextColor="" buttonTextFormat="0" buttonTextFontSize="16" dividerColor="" dividerBorderWidth="1" textBaseColor="" textBaseFontSize="14" textBaseLineHeight="150" textBaseLetterSpacing="0" textLinkColor="" heading1Color="#18181B" heading1FontSize="32" heading1LineHeight="120" heading1LetterSpacing="2" heading2Color="" heading2FontSize="24" heading2LineHeight="125" heading2LetterSpacing="0" heading3Color="" heading3FontSize="20" heading3LineHeight="125" heading3LetterSpacing="0" />`;

const TEMPLATE = {
  name: NAME,
  subject: "Your code is {data.otpCode}",
  previewText: "Use this code to sign in to Finsepa.",
  dataVariables: ["firstName", "otpCode"],
  lmx: [
    SHARED_STYLE,
    `<Paragraph paddingTop="8">Hi {data.firstName},</Paragraph>`,
    `<Paragraph paddingBottom="8"></Paragraph>`,
    `<Paragraph fontSize="16" paddingBottom="16"><Text format="1">Your login code for Finsepa is:</Text></Paragraph>`,
    // Grey panel + black code for light theme.
    `<Section blockColor="#F4F4F5" blockBorderRadius="12" paddingTop="22" paddingBottom="22" paddingLeft="20" paddingRight="20">`,
    `<H1 align="center" fontSize="32" lineHeight="120"><Text textColor="#18181B" format="1">{data.otpCode}</Text></H1>`,
    `</Section>`,
    `<Paragraph paddingBottom="16"></Paragraph>`,
    `<Paragraph fontSize="14" paddingBottom="12">This code is valid for the next 5 minutes. You should never share this code with anyone.</Paragraph>`,
    `<Paragraph fontSize="14" paddingBottom="16">If you didn’t request this, you can safely ignore this email.</Paragraph>`,
    `<Paragraph>Thanks,</Paragraph>`,
    `<Paragraph paddingBottom="16">The Finsepa Team</Paragraph>`,
    `<Paragraph fontSize="12"><Text textColor="#A1A1AA">Finsepa provides tools for research and portfolio tracking. We do not provide investment advice.</Text></Paragraph>`,
  ].join("\n"),
};

const dryRun = process.argv.includes("--dry-run");
const testEmailArg = process.argv.findIndex((a) => a === "--test-email");
const testEmail = testEmailArg >= 0 ? process.argv[testEmailArg + 1]?.trim() : "";

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

async function main() {
  let tx = await findExistingByName(TEMPLATE.name);
  if (tx) {
    console.log(`Found existing "${TEMPLATE.name}" (${tx.id})`);
  } else if (dryRun) {
    console.log("(dry-run) would create transactional");
    return;
  } else {
    console.log(`Creating "${TEMPLATE.name}"…`);
    tx = await loops("/transactional-emails", {
      method: "POST",
      body: { name: TEMPLATE.name, transactionalGroupId: DEFAULT_GROUP_ID },
    });
    console.log(`  Created ${tx.id}`);
  }

  if (dryRun) {
    console.log(`LOOPS_TRANSACTIONAL_ID_EMAIL_OTP=${tx.id}`);
    return;
  }

  // List GET often omits draft ids — create/refresh draft and use that response.
  const draftMeta = await loops(`/transactional-emails/${tx.id}/draft`, {
    method: "POST",
    body: {},
  });
  const draftId = draftMeta.draftEmailMessageId;
  const revisionId = draftMeta.draftEmailMessageContentRevisionId;
  if (!draftId || !revisionId) throw new Error("Missing draft ids");

  const draft = await loops(`/email-messages/${draftId}`);
  await loops(`/email-messages/${draftId}`, {
    method: "POST",
    body: {
      expectedRevisionId: draft.contentRevisionId ?? revisionId,
      subject: TEMPLATE.subject,
      previewText: TEMPLATE.previewText,
      fromName: "Finsepa",
      fromEmail: "hi",
      replyToEmail: "hi@finsepa.com",
      emailFormat: "styled",
      lmx: TEMPLATE.lmx,
    },
  });
  console.log("  Draft updated");

  await loops(`/transactional-emails/${tx.id}/publish`, { method: "POST" });
  console.log("  Published");

  if (testEmail) {
    const sent = await loops("/transactional", {
      method: "POST",
      body: {
        transactionalId: tx.id,
        email: testEmail,
        addContact: false,
        dataVariables: { firstName: "there", otpCode: "938490" },
      },
    });
    console.log(`  Test send → ${testEmail}:`, sent?.success === true ? "ok" : JSON.stringify(sent));
  }

  console.log(`
=== Add to .env.local ===
AUTH_EMAIL_OTP=1
NEXT_PUBLIC_AUTH_EMAIL_OTP=1
LOOPS_TRANSACTIONAL_ID_EMAIL_OTP=${tx.id}

Loops editor: https://app.loops.so/transactional-emails/${tx.id}
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
