"use client";

import { useEffect, useRef } from "react";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";

import { cn } from "@/lib/utils";

type DropdownMenuLottieIconProps = {
  animationData: unknown;
  /** When false, holds the first frame (static). When true, plays once from the start. */
  playing: boolean;
  className?: string;
};

/** 16×16 layout slot; 20×20 Lottie artwork centered inside. */
export function DropdownMenuLottieIcon({
  animationData,
  playing,
  className,
}: DropdownMenuLottieIconProps) {
  const lottieRef = useRef<LottieRefCurrentProps>(null);

  useEffect(() => {
    const anim = lottieRef.current;
    if (!anim) return;
    if (playing) {
      anim.goToAndPlay(0, true);
    } else {
      anim.goToAndStop(0, true);
    }
  }, [playing]);

  return (
    <span className={cn("relative h-4 w-4 shrink-0 overflow-visible", className)} aria-hidden>
      <span className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2">
        <Lottie
          lottieRef={lottieRef}
          animationData={animationData}
          loop={false}
          autoplay={false}
          onDOMLoaded={() => lottieRef.current?.goToAndStop(0, true)}
          style={{ width: "100%", height: "100%" }}
        />
      </span>
    </span>
  );
}
