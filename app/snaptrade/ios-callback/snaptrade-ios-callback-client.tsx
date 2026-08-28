"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { Spinner } from "@/components/ui/spinner";

const IOS_CALLBACK_SCHEME = "finsepa://snaptrade/callback";

function SnapTradeIOSCallbackInner() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    const target = query ? `${IOS_CALLBACK_SCHEME}?${query}` : IOS_CALLBACK_SCHEME;
    window.location.replace(target);
  }, [searchParams]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <Spinner className="size-6 text-fg-muted" />
      <p className="text-sm text-fg-muted">Returning to Finsepa…</p>
    </div>
  );
}

export function SnapTradeIOSCallbackClient() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center gap-3 py-8">
          <Spinner className="size-6 text-fg-muted" />
          <p className="text-sm text-fg-muted">Returning to Finsepa…</p>
        </div>
      }
    >
      <SnapTradeIOSCallbackInner />
    </Suspense>
  );
}
