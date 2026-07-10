import { NextResponse } from "next/server";

import { displayNameFromUser } from "@/lib/auth/user-display";
import { getLoopsApiKey } from "@/lib/env/loops";
import { getLoopsTransactionalHelpFeedbackId } from "@/lib/env/server";
import { sendHelpFeedbackEmail } from "@/lib/loops/send-help-feedback";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  SUPPORT_FEEDBACK_MAX_FILE_BYTES,
  SUPPORT_FEEDBACK_MAX_FILES,
  SUPPORT_FEEDBACK_MAX_TOTAL_BYTES,
  SUPPORT_FEEDBACK_MESSAGE_MAX_LENGTH,
} from "@/lib/support/feedback-constants";
import { parseFeedbackFormFiles } from "@/lib/support/feedback-form-files";
import { uploadFeedbackAttachments } from "@/lib/support/upload-feedback-attachments";
import { AuthRequiredError, requireAuthUser } from "@/lib/watchlist/api-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-()+]/g, "_").replace(/_+/g, "_").slice(0, 120) || "file";
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const user = await requireAuthUser(supabase);

    const form = await request.formData();
    const emailRaw = form.get("email");
    const messageRaw = form.get("message");
    const pageUrlRaw = form.get("pageUrl");

    const email = typeof emailRaw === "string" ? emailRaw.trim() : "";
    const message = typeof messageRaw === "string" ? messageRaw.trim() : "";
    const pageUrl = typeof pageUrlRaw === "string" ? pageUrlRaw.trim() : "";

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }
    if (message.length > SUPPORT_FEEDBACK_MESSAGE_MAX_LENGTH) {
      return NextResponse.json({ error: "Message is too long." }, { status: 400 });
    }

    const fileEntries = parseFeedbackFormFiles(form);
    if (fileEntries.length > SUPPORT_FEEDBACK_MAX_FILES) {
      return NextResponse.json({ error: `You can attach up to ${SUPPORT_FEEDBACK_MAX_FILES} files.` }, { status: 400 });
    }

    let totalBytes = 0;
    for (const file of fileEntries) {
      if (file.size > SUPPORT_FEEDBACK_MAX_FILE_BYTES) {
        return NextResponse.json({ error: "Each file must be 50 MB or smaller." }, { status: 400 });
      }
      totalBytes += file.size;
    }
    if (totalBytes > SUPPORT_FEEDBACK_MAX_TOTAL_BYTES) {
      return NextResponse.json({ error: "Total attachment size must be 50 MB or smaller." }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();
    let attachmentLinks: string | null = null;
    let imageUrl: string | null = null;

    if (fileEntries.length > 0) {
      if (!admin) {
        attachmentLinks = fileEntries.map((file) => `${file.name} (storage unavailable)`).join("\n");
      } else {
        const uploaded = await uploadFeedbackAttachments({
          admin,
          userId: user.id,
          files: fileEntries,
          sanitizeFileName,
        });
        attachmentLinks = uploaded.attachmentLinks;
        imageUrl = uploaded.imageUrl;
        if (uploaded.failures.length > 0) {
          console.warn("[support/feedback] attachment failures:", uploaded.failures.join("; "));
        }
      }
    }

    const loopsKey = getLoopsApiKey();
    const transactionalId = getLoopsTransactionalHelpFeedbackId();
    if (!loopsKey) {
      return NextResponse.json(
        { error: "Help feedback is not configured on this environment yet." },
        { status: 503 },
      );
    }

    const userName = displayNameFromUser(user) ?? email.split("@")[0] ?? "Finsepa user";
    const sent = await sendHelpFeedbackEmail({
      apiKey: loopsKey,
      transactionalId,
      userEmail: email,
      userName,
      message,
      pageUrl: pageUrl || null,
      attachmentLinks,
      imageUrl,
    });

    if (!sent.ok) {
      console.error("[support/feedback]", sent.message);
      return NextResponse.json({ error: sent.message }, { status: 502 });
    }

    console.info("[support/feedback] delivered via Loops to", sent.to);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Failed to send feedback.";
    console.error("[support/feedback POST]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
