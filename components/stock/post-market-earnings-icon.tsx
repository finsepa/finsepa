"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

type PostMarketEarningsIconProps = {
  className?: string;
  /** Rendered width/height in px; viewBox stays 24×24. Default matches Figma stock card. */
  size?: number;
};

/** Post-market / closed session moon — light keeps #DBEAFE / #2563EB; dark uses accent soft + accent. */
export function PostMarketEarningsIcon({ className, size = 24 }: PostMarketEarningsIconProps) {
  const uid = useId().replace(/:/g, "");
  const clipId = `earnings-moon-clip-${uid}`;
  const box = { width: size, height: size, maxWidth: size, maxHeight: size, minWidth: size, minHeight: size, flex: "0 0 auto" as const };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("block shrink-0 flex-none", className)}
      style={box}
      aria-hidden
    >
      <rect
        width="24"
        height="24"
        rx="12"
        className="fill-[#DBEAFE] dark:fill-[var(--fs-accent-soft)]"
      />
      <g clipPath={`url(#${clipId})`}>
        <path
          d="M17 13.9221C16.3433 14.2191 15.6143 14.3844 14.8467 14.3844C11.9576 14.3844 9.61558 12.0424 9.61558 9.15327C9.61558 8.38568 9.7809 7.6567 10.0779 7C8.26288 7.82082 7 9.64735 7 11.7688C7 14.6579 9.34207 17 12.2312 17C14.3527 17 16.1792 15.7371 17 13.9221Z"
          className="fill-[#2563EB] stroke-[#2563EB] dark:fill-[var(--fs-accent)] dark:stroke-[var(--fs-accent)]"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <defs>
        <clipPath id={clipId}>
          <rect width="12" height="12" fill="white" transform="translate(6 6)" />
        </clipPath>
      </defs>
    </svg>
  );
}
