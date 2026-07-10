import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const SUPPORT_FEEDBACK_BUCKET = "support-feedback";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 14;

export type FeedbackUploadFile = {
  name: string;
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

export type FeedbackUploadedAttachment = {
  name: string;
  url: string;
  isImage: boolean;
};

function isImageMimeType(type: string): boolean {
  return type.startsWith("image/");
}

function mimeTypeForUpload(file: FeedbackUploadFile): string {
  const type = file.type.trim();
  if (type && type.includes("/")) return type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "heic":
      return "image/heic";
    case "pdf":
      return "application/pdf";
    case "txt":
      return "text/plain";
    case "csv":
      return "text/csv";
    default:
      return type || "application/octet-stream";
  }
}

function formatAttachmentLinks(attachments: FeedbackUploadedAttachment[]): string {
  if (attachments.length === 0) return "None";
  return attachments
    .map((a) => `${a.name}\n${a.url}`)
    .join("\n\n");
}

function formatAttachmentLinksWithFailures(
  attachments: FeedbackUploadedAttachment[],
  failures: string[],
): string {
  const parts: string[] = [];
  if (attachments.length > 0) {
    parts.push(formatAttachmentLinks(attachments));
  }
  if (failures.length > 0) {
    parts.push(failures.join("\n"));
  }
  return parts.length > 0 ? parts.join("\n\n") : "None";
}

export async function uploadFeedbackAttachments(params: {
  admin: SupabaseClient;
  userId: string;
  files: FeedbackUploadFile[];
  sanitizeFileName: (name: string) => string;
}): Promise<{
  attachments: FeedbackUploadedAttachment[];
  imageUrl: string | null;
  attachmentLinks: string;
  failures: string[];
}> {
  const prefix = `${params.userId}/${Date.now()}`;
  const attachments: FeedbackUploadedAttachment[] = [];
  const failures: string[] = [];

  for (const file of params.files) {
    try {
      const path = `${prefix}/${params.sanitizeFileName(file.name)}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const contentType = mimeTypeForUpload(file);

      const { error } = await params.admin.storage.from(SUPPORT_FEEDBACK_BUCKET).upload(path, buffer, {
        contentType,
        upsert: false,
      });
      if (error) {
        console.error("[support/feedback] attachment upload failed:", file.name, error.message);
        failures.push(`${file.name} (upload failed)`);
        continue;
      }

      const { data, error: signErr } = await params.admin.storage
        .from(SUPPORT_FEEDBACK_BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      if (signErr || !data?.signedUrl) {
        console.error("[support/feedback] signed URL failed:", file.name, signErr?.message);
        failures.push(`${file.name} (link unavailable)`);
        continue;
      }

      attachments.push({
        name: file.name,
        url: data.signedUrl,
        isImage: isImageMimeType(contentType),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "upload error";
      console.error("[support/feedback] attachment processing failed:", file.name, message);
      failures.push(`${file.name} (upload failed)`);
    }
  }

  const imageUrl = attachments.find((a) => a.isImage)?.url ?? null;
  return {
    attachments,
    imageUrl,
    attachmentLinks: formatAttachmentLinksWithFailures(attachments, failures),
    failures,
  };
}
