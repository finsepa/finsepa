"use client";

import { useEffect, useState } from "react";

/** Matches mobile shell / bottom nav breakpoint (`md` = 768px). */
export const MOBILE_SHEET_MEDIA_QUERY = "(max-width: 767px)";

export function useMobileSheet() {
  const [isMobileSheet, setIsMobileSheet] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_SHEET_MEDIA_QUERY);
    const update = () => setIsMobileSheet(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isMobileSheet;
}
