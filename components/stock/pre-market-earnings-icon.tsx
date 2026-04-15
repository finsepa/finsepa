"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

/** Pre-market (BMO) earnings — asset from design (`Frame 19.svg`), 20×20 with #FFEDD5 fill. */
export function PreMarketEarningsIcon({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const clipId = `earnings-pre-market-clip-${uid}`;

  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <rect width="20" height="20" rx="10" fill="#FFEDD5" />
      <g clipPath={`url(#${clipId})`}>
        <path
          d="M12.8037 6.77832L12.9219 7.0752L13.2178 7.19531L15.0254 7.92773L14.3047 9.71973L14.1914 10L14.3047 10.2803L15.0254 12.0713L13.2178 12.8047L12.9219 12.9248L12.8037 13.2217L12.082 15.0244L10.2783 14.3037L10 14.1924L9.72168 14.3037L7.91699 15.0244L7.19629 13.2217L7.07812 12.9248L6.78223 12.8047L4.97363 12.0713L5.69531 10.2803L5.80859 10L5.69531 9.71973L4.97363 7.92773L6.78223 7.19531L7.07812 7.0752L7.19629 6.77832L7.91699 4.97461L9.72168 5.69629L10 5.80762L10.2783 5.69629L12.082 4.97461L12.8037 6.77832ZM10 6.25C7.92879 6.25 6.25 7.92879 6.25 10C6.25 12.0712 7.92879 13.75 10 13.75C12.0712 13.75 13.75 12.0712 13.75 10C13.75 7.92879 12.0712 6.25 10 6.25Z"
          fill="#09090B"
          stroke="#EA580C"
          strokeWidth="1.5"
        />
      </g>
      <defs>
        <clipPath id={clipId}>
          <rect width="12" height="12" fill="white" transform="translate(4 4)" />
        </clipPath>
      </defs>
    </svg>
  );
}
