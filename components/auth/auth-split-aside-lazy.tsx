"use client";

import dynamic from "next/dynamic";

export const AuthSplitAsidePanelLazy = dynamic(
  () => import("./auth-split-aside-panel").then((m) => m.AuthSplitAsidePanel),
  {
    ssr: false,
    loading: () => (
      <div
        className="relative h-full min-h-[calc(100dvh-8px)] w-full overflow-hidden rounded-[8px] bg-[#FAFAFA]"
        aria-hidden
      />
    ),
  },
);
