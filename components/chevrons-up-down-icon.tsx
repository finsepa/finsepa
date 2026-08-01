"use client";

import { useEffect, useImperativeHandle, useState } from "react";
import { motion, useAnimation } from "motion/react";

export type ChevronsUpDownIconHandle = {
  startAnimation: () => void;
  stopAnimation: () => void;
};

export type ChevronsUpDownIconProps = React.ComponentPropsWithoutRef<"svg"> & {
  ref?: React.Ref<ChevronsUpDownIconHandle>;
  duration?: number;
};

const PATH_DOWN = "M7 15L12 20L17 15";
const PATH_UP = "M7 9L12 4L17 9";

/** Animated chevrons — morphs up-down ↔ down-up (https://chanhdai.com/components/chevrons-up-down-icon). */
export function ChevronsUpDownIcon({
  ref,
  duration = 0.3,
  ...props
}: ChevronsUpDownIconProps) {
  const controls = useAnimation();
  // motion.path SSR markup can disagree with the client first paint — static paths until mount.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useImperativeHandle(ref, () => ({
    startAnimation: () => controls.start("animate"),
    stopAnimation: () => controls.start("normal"),
  }));

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {mounted ? (
        <>
          <motion.path
            d={PATH_DOWN}
            variants={{
              normal: { d: PATH_DOWN },
              animate: { d: "M7 20L12 15L17 20" },
            }}
            initial="normal"
            animate={controls}
            transition={{ duration }}
          />
          <motion.path
            d={PATH_UP}
            variants={{
              normal: { d: PATH_UP },
              animate: { d: "M7 4L12 9L17 4" },
            }}
            initial="normal"
            animate={controls}
            transition={{ duration }}
          />
        </>
      ) : (
        <>
          <path d={PATH_DOWN} />
          <path d={PATH_UP} />
        </>
      )}
    </svg>
  );
}
