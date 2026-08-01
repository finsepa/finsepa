"use client";

import dynamic from "next/dynamic";

function SignupFormSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading sign-up form">
      <div className="h-10 animate-pulse rounded-[10px] bg-surface-muted" />
      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-stroke" />
        <div className="h-3 w-6 rounded bg-stroke" />
        <div className="h-px flex-1 bg-stroke" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="h-16 animate-pulse rounded-[10px] bg-surface-muted" />
        <div className="h-16 animate-pulse rounded-[10px] bg-surface-muted" />
      </div>
      <div className="h-16 animate-pulse rounded-[10px] bg-surface-muted" />
      <div className="h-16 animate-pulse rounded-[10px] bg-surface-muted" />
      <div className="h-11 animate-pulse rounded-[10px] bg-stroke" />
    </div>
  );
}

/** Client-only bundle: avoids stale SSR HTML vs fresh client JS (submit label hydration mismatch in dev). */
export const SignupClientDynamic = dynamic(
  () => import("./signup-client").then((mod) => mod.SignupClient),
  { ssr: false, loading: SignupFormSkeleton },
);
