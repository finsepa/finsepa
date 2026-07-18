"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { CircleCheck, Upload, X } from "@/lib/icons";
import { SpinnerLabel } from "@/components/ui/spinner";

import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import {
  AppModalFooter,
  AppModalShell,
  appModalCancelButtonClass,
  appModalPrimaryButtonClass,
} from "@/components/ui/app-modal-shell";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  SUPPORT_FEEDBACK_MAX_FILE_BYTES,
  SUPPORT_FEEDBACK_MAX_FILES,
  SUPPORT_FEEDBACK_MAX_TOTAL_BYTES,
  SUPPORT_FEEDBACK_MESSAGE_MAX_LENGTH,
} from "@/lib/support/feedback-constants";
import { cn } from "@/lib/utils";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function HelpFeedbackModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<"form" | "success">("form");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPhase("form");
    setMessage("");
    setFiles([]);
    setDragOver(false);
    setSubmitting(false);
    setError(null);

    void getSupabaseBrowserClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        setEmail(user?.email?.trim() ?? "");
      })
      .catch(() => {
        setEmail("");
      });
  }, [open]);

  const totalFileBytes = useMemo(() => files.reduce((sum, f) => sum + f.size, 0), [files]);

  const canSend = useMemo(() => {
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();
    return (
      trimmedEmail.includes("@") &&
      trimmedMessage.length > 0 &&
      trimmedMessage.length <= SUPPORT_FEEDBACK_MESSAGE_MAX_LENGTH &&
      files.length <= SUPPORT_FEEDBACK_MAX_FILES &&
      totalFileBytes <= SUPPORT_FEEDBACK_MAX_TOTAL_BYTES &&
      files.every((f) => f.size <= SUPPORT_FEEDBACK_MAX_FILE_BYTES)
    );
  }, [email, files, message, totalFileBytes]);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const next = [...files];
    let nextTotal = totalFileBytes;

    for (const file of Array.from(incoming)) {
      if (next.length >= SUPPORT_FEEDBACK_MAX_FILES) break;
      if (file.size > SUPPORT_FEEDBACK_MAX_FILE_BYTES) {
        setError("Each file must be 50 MB or smaller.");
        continue;
      }
      if (nextTotal + file.size > SUPPORT_FEEDBACK_MAX_TOTAL_BYTES) {
        setError("Total attachment size must be 50 MB or smaller.");
        break;
      }
      if (next.some((f) => f.name === file.name && f.size === file.size)) continue;
      next.push(file);
      nextTotal += file.size;
    }

    setError(null);
    setFiles(next);
  }, [files, totalFileBytes]);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  }, []);

  const handleSend = useCallback(async () => {
    if (!canSend || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const form = new FormData();
      form.set("email", email.trim());
      form.set("message", message.trim());
      form.set("pageUrl", typeof window !== "undefined" ? window.location.href : "");
      for (const file of files) {
        form.append("files", file);
      }

      const res = await fetch("/api/support/feedback", { method: "POST", body: form });
      const raw = await res.text();
      let data: { error?: string; ok?: boolean } = {};
      if (raw) {
        try {
          data = JSON.parse(raw) as { error?: string; ok?: boolean };
        } catch {
          data = {};
        }
      }
      if (!res.ok || data.ok !== true) {
        const detail =
          data.error?.trim() ||
          (raw && !raw.startsWith("{") ? raw.slice(0, 200) : null) ||
          (res.status ? `Could not send your message (${res.status}).` : null);
        throw new Error(detail ?? "Could not send your message.");
      }

      setPhase("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send your message.");
    } finally {
      setSubmitting(false);
    }
  }, [canSend, email, files, message, submitting]);

  if (!open) return null;

  return (
    <AppModalOverlay open={open} onClose={submitting ? undefined : onClose} zIndex={120}>
      <AppModalShell
        titleId={titleId}
        title={phase === "success" ? "Your email was sent" : "What happened?"}
        onClose={onClose}
        closeDisabled={submitting}
        maxWidthClass="w-full max-w-[480px]"
        bodyClassName={phase === "success" ? "px-5 pb-6 pt-2" : "flex flex-col gap-4 px-5 pb-5 pt-5"}
        footer={
          <AppModalFooter className={phase === "success" ? "justify-end" : undefined}>
            {phase === "success" ? (
              <button type="button" onClick={onClose} className={appModalPrimaryButtonClass(true)}>
                Close
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className={appModalCancelButtonClass}
                >
                  Discard
                </button>
                <button
                  type="button"
                  disabled={!canSend || submitting}
                  onClick={() => void handleSend()}
                  className={appModalPrimaryButtonClass(canSend && !submitting)}
                >
                  {submitting ?
                    <SpinnerLabel>Sending…</SpinnerLabel>
                  : "Send"}
                </button>
              </>
            )}
          </AppModalFooter>
        }
      >
        {phase === "success" ? (
          <div className="flex flex-col items-center px-2 pb-2 pt-4 text-center">
            <div
              className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#DCFCE7]"
              aria-hidden
            >
              <CircleCheck className="h-7 w-7 text-[#16A34A]" strokeWidth={2} />
            </div>
            <p className="max-w-[320px] text-sm leading-relaxed text-[#71717A]">
              Thank you for your message. We&apos;ll review it and get back to you as soon as we can.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <label htmlFor={`${titleId}-message`} className="text-sm font-medium leading-5 text-[#0F0F0F]">
                Message <span className="text-[#DC2626]">*</span>
              </label>
              <textarea
                id={`${titleId}-message`}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                maxLength={SUPPORT_FEEDBACK_MESSAGE_MAX_LENGTH}
                placeholder="Is there an issue, a question or a suggestion you'd like to share with us?"
                className="min-h-[120px] w-full resize-y rounded-[10px] border border-[#E4E4E7] bg-white px-3 py-2.5 text-sm text-[#0F0F0F] placeholder:text-[#71717A] outline-none focus:ring-2 focus:ring-[#0F0F0F]/10"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex min-h-[88px] cursor-pointer flex-col items-center justify-center rounded-[10px] border border-dashed px-4 py-5 text-center transition-colors",
                  dragOver ? "border-[#0F0F0F] bg-[#F4F4F5]" : "border-[#D4D4D8] bg-[#FAFAFA] hover:border-[#A1A1AA]",
                )}
              >
                <Upload className="mb-2 h-5 w-5 text-[#71717A]" aria-hidden />
                <p className="text-sm text-[#52525B]">
                  Please upload file if needed
                  <span className="block text-xs text-[#71717A]">
                    Files no larger than 50 MB, up to {SUPPORT_FEEDBACK_MAX_FILES} files
                  </span>
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    if (e.target.files?.length) addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>

              {files.length > 0 ? (
                <ul className="flex flex-col gap-1.5 rounded-[10px] border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2">
                  {files.map((file, index) => (
                    <li key={`${file.name}-${file.size}-${index}`} className="flex items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate text-[#0F0F0F]">{file.name}</span>
                      <span className="shrink-0 tabular-nums text-xs text-[#71717A]">
                        {formatFileSize(file.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#0F0F0F]"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="h-4 w-4" strokeWidth={2} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {error ? (
              <p className="text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
          </>
        )}
      </AppModalShell>
    </AppModalOverlay>
  );
}
