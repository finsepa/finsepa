"use client";

import { useEffect } from "react";

export default function HeatmapsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Heatmaps error:", error);
  }, [error]);

  return (
    <div className="min-w-0 px-4 py-4 sm:px-9 sm:py-6">
      <div className="rounded-[12px] border border-[#E4E4E7] bg-white px-4 py-6 text-center">
        <p className="text-sm font-medium text-[#0F0F0F]">Something went wrong loading the heatmap.</p>
        <p className="mt-2 text-sm text-[#71717A]">{error.message || "Unknown error"}</p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-4 rounded-[10px] border border-[#E4E4E7] bg-[#F4F4F5] px-4 py-2 text-sm font-medium text-[#0F0F0F] transition-colors hover:bg-[#E4E4E7]"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
