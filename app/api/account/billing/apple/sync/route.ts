import { NextResponse } from "next/server";

import { applyAppleTransaction } from "@/lib/account/billing-apple";
import {
  claimProWelcomeEmailSend,
  clearProWelcomeEmailClaim,
  resolveUserEmailById,
} from "@/lib/account/billing-db";
import { verifyAppleRenewalInfo, verifyAppleTransaction } from "@/lib/apple/verify";
import { resolveAuthUserFromRequest } from "@/lib/auth/resolve-auth-user";
import { getLoopsApiKey } from "@/lib/env/loops";
import { sendLoopsProActivatedEmail } from "@/lib/loops/send-pro-activated";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await resolveAuthUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    signedTransaction?: unknown;
    signedRenewalInfo?: unknown;
  };
  const signedTransaction =
    typeof body.signedTransaction === "string" ? body.signedTransaction.trim() : "";
  if (!signedTransaction) {
    return NextResponse.json({ error: "signedTransaction is required." }, { status: 400 });
  }

  let transaction;
  try {
    transaction = await verifyAppleTransaction(signedTransaction);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid Apple transaction.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const token = typeof transaction.appAccountToken === "string" ? transaction.appAccountToken.trim() : "";
  if (token && token.toLowerCase() !== user.id.toLowerCase()) {
    return NextResponse.json(
      { error: "This Apple purchase belongs to a different Finsepa account." },
      { status: 403 },
    );
  }

  let renewal = null;
  const signedRenewalInfo =
    typeof body.signedRenewalInfo === "string" ? body.signedRenewalInfo.trim() : "";
  if (signedRenewalInfo) {
    try {
      renewal = await verifyAppleRenewalInfo(signedRenewalInfo);
    } catch {
      renewal = null;
    }
  }

  try {
    const result = await applyAppleTransaction({
      userId: user.id,
      transaction,
      renewal,
    });

    if (result.isPro) {
      const apiKey = getLoopsApiKey();
      if (apiKey) {
        const claimed = await claimProWelcomeEmailSend(user.id);
        if (claimed) {
          const email = user.email ?? (await resolveUserEmailById(user.id));
          if (email) {
            const sent = await sendLoopsProActivatedEmail({ apiKey, to: email });
            if (!sent.ok) await clearProWelcomeEmailClaim(user.id);
          } else {
            await clearProWelcomeEmailClaim(user.id);
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      isPro: result.isPro,
      planCode: result.planCode,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not sync Apple subscription.";
    const status = message.includes("another Finsepa account") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
