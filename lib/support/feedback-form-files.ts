import type { FeedbackUploadFile } from "@/lib/support/upload-feedback-attachments";

function isBlobLike(value: FormDataEntryValue): value is File {
  return (
    typeof value === "object" &&
    value != null &&
    "arrayBuffer" in value &&
    typeof (value as Blob).arrayBuffer === "function"
  );
}

function fileNameFromEntry(value: File, index: number): string {
  if (value.name.trim()) return value.name.trim();
  return `attachment-${index + 1}`;
}

function fileSizeFromEntry(value: File): number {
  if (typeof value.size === "number" && Number.isFinite(value.size)) return value.size;
  return 0;
}

/** Accept File or Blob entries from multipart FormData (Node/Vercel may not use `instanceof File`). */
export function parseFeedbackFormFiles(form: FormData): FeedbackUploadFile[] {
  const files: FeedbackUploadFile[] = [];

  form.getAll("files").forEach((entry, index) => {
    if (!isBlobLike(entry)) return;
    const size = fileSizeFromEntry(entry);
    if (size <= 0) return;

    const name = fileNameFromEntry(entry, index);
    files.push({
      name,
      type: typeof entry.type === "string" ? entry.type : "",
      size,
      arrayBuffer: () => entry.arrayBuffer(),
    });
  });

  return files;
}
