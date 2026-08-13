import { NextResponse } from "next/server";

import { applyAppleTransactionForKnownOrTokenUser } from "@/lib/account/billing-apple";
import { verifyAppleNotification, verifyAppleRenewalInfo, verifyAppleTransaction } from "@/lib/apple/verify";

export const runtime = "nodejs";

/**
 * App Store Server Notifications V2.
 * App Store Connect → App → App Information → App Store Server Notifications
 * Production/Sandbox URL: https://app.finsepa.com/api/apple/notifications
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { signedPayload?: unknown };
  const signedPayload = typeof body.signedPayload === "string" ? body.signedPayload.trim() : "";
  if (!signedPayload) {
    return NextResponse.json({ error: "signedPayload is required." }, { status: 400 });
  }

  try {
    const notification = await verifyAppleNotification(signedPayload);
    const signedTransactionInfo = notification.data?.signedTransactionInfo;
    if (!signedTransactionInfo) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const transaction = await verifyAppleTransaction(signedTransactionInfo);
    let renewal = null;
    if (notification.data?.signedRenewalInfo) {
      try {
        renewal = await verifyAppleRenewalInfo(notification.data.signedRenewalInfo);
      } catch {
        renewal = null;
      }
    }

    await applyAppleTransactionForKnownOrTokenUser({ transaction, renewal });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid Apple notification.";
    console.error("[apple-notifications]", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
