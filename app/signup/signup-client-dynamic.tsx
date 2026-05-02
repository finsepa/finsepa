"use client";

import dynamic from "next/dynamic";

function SignupFormSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading sign-up form">
      <div className="h-10 animate-pulse rounded-[10px] bg-[#F4F4F5]" />
      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-[#E4E4E7]" />
        <div className="h-3 w-6 rounded bg-[#E4E4E7]" />
        <div className="h-px flex-1 bg-[#E4E4E7]" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="h-16 animate-pulse rounded-[10px] bg-[#F4F4F5]" />
        <div className="h-16 animate-pulse rounded-[10px] bg-[#F4F4F5]" />
      </div>
      <div className="h-16 animate-pulse rounded-[10px] bg-[#F4F4F5]" />
      <div className="h-16 animate-pulse rounded-[10px] bg-[#F4F4F5]" />
      <div className="h-11 animate-pulse rounded-[10px] bg-[#E4E4E7]" />
    </div>
  );
}

/** Client-only bundle: avoids stale SSR HTML vs fresh client JS (submit label hydration mismatch in dev). */
export const SignupClientDynamic = dynamic(
  () => import("./signup-client").then((mod) => mod.SignupClient),
  { ssr: false, loading: SignupFormSkeleton },
);
