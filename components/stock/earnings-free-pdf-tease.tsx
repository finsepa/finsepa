"use client";

import { useEffect, useRef, useState } from "react";

import { Spinner } from "@/components/ui/spinner";

/**
 * Free Slides tease: render real PDF page(s) to canvas (no Chromium PDF chrome → no download).
 * Fills the modal body like the Reports iframe under the Pro blur gate.
 */
export function EarningsFreePdfTease({
  proxySrc,
  label,
}: {
  /** Same-origin `/api/ir-pdf?u=…` URL */
  proxySrc: string;
  label: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    let destroyDoc: (() => void) | null = null;

    async function run() {
      setStatus("loading");
      const host = hostRef.current;
      if (!host) return;
      host.replaceChildren();

      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        const loadingTask = pdfjs.getDocument({ url: proxySrc, withCredentials: false });
        destroyDoc = () => {
          try {
            void loadingTask.destroy();
          } catch {
            /* ignore */
          }
        };
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        // Wait a frame so absolute inset-0 has a real width (match Reports full-bleed).
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        if (cancelled) return;

        const width = Math.max(
          host.clientWidth || host.parentElement?.clientWidth || 0,
          640,
        );
        const pagesToShow = Math.min(pdf.numPages, 2);

        for (let i = 1; i <= pagesToShow; i++) {
          if (cancelled) return;
          const page = await pdf.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const scale = width / base.width;
          const viewport = page.getViewport({ scale });
          const outputScale = Math.min(window.devicePixelRatio || 1, 2);

          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width * outputScale);
          canvas.height = Math.floor(viewport.height * outputScale);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          canvas.style.display = "block";
          canvas.setAttribute("aria-hidden", "true");

          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
          await page.render({ canvas, canvasContext: ctx, viewport, transform }).promise;
          if (cancelled) return;
          host.appendChild(canvas);
        }

        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    void run();
    return () => {
      cancelled = true;
      destroyDoc?.();
    };
  }, [proxySrc]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#d4d4d8]" aria-hidden>
      {status === "loading" ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <Spinner className="size-5 text-[#71717A]" />
        </div>
      ) : null}
      {status === "error" ? (
        <div className="flex h-full items-center justify-center px-8">
          <div className="w-full max-w-3xl space-y-4 rounded-sm bg-white px-10 py-12 shadow-sm">
            <div className="h-3 w-24 rounded bg-neutral-300" />
            <div className="h-8 w-2/3 rounded bg-neutral-800/70" />
            <div className="h-40 rounded bg-neutral-200" />
            <p className="text-[12px] text-neutral-400">{label}</p>
          </div>
        </div>
      ) : null}
      <div ref={hostRef} className="flex w-full flex-col items-stretch" />
    </div>
  );
}
