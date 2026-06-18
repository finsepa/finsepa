import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const SUPPORT_FEEDBACK_BUCKET = "support-feedback";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 14;

export type FeedbackUploadedAttachment = {
  name: string;
  url: string;
  isImage: boolean;
};

function isImageMimeType(type: string): boolean {
  return type.startsWith("image/");
}

function formatAttachmentLinks(attachments: FeedbackUploadedAttachment[]): string {
  if (attachments.length === 0) return "None";
  return attachments
    .map((a) => `${a.name}\n${a.url}`)
    .join("\n\n");
}

export async function uploadFeedbackAttachments(params: {
  admin: SupabaseClient;
  userId: string;
  files: File[];
  sanitizeFileName: (name: string) => string;
}): Promise<
  | {
      ok: true;
      attachments: FeedbackUploadedAttachment[];
      imageUrl: string | null;
      attachmentLinks: string;
    }
  | { ok: false; message: string }
> {
  const prefix = `${params.userId}/${Date.now()}`;
  const attachments: FeedbackUploadedAttachment[] = [];

  for (const file of params.files) {
    const path = `${prefix}/${params.sanitizeFileName(file.name)}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || "application/octet-stream";

    const { error } = await params.admin.storage.from(SUPPORT_FEEDBACK_BUCKET).upload(path, buffer, {
      contentType,
      upsert: false,
    });
    if (error) {
      console.error("[support/feedback] attachment upload failed:", error.message);
      return { ok: false, message: `Could not upload ${file.name}. Try again in a moment.` };
    }

    const { data, error: signErr } = await params.admin.storage
      .from(SUPPORT_FEEDBACK_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (signErr || !data?.signedUrl) {
      console.error("[support/feedback] signed URL failed:", signErr?.message);
      return { ok: false, message: `Could not prepare a link for ${file.name}. Try again.` };
    }

    attachments.push({
      name: file.name,
      url: data.signedUrl,
      isImage: isImageMimeType(contentType),
    });
  }

  const imageUrl = attachments.find((a) => a.isImage)?.url ?? null;
  return {
    ok: true,
    attachments,
    imageUrl,
    attachmentLinks: formatAttachmentLinks(attachments),
  };
}
