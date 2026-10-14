/** GA4 web stream shared with www.finsepa.com, so marketing visits and app sign-ups land in one property. */
export const GA_MEASUREMENT_ID = "G-WYKL5XRX6F";

type Gtag = (...args: unknown[]) => void;

export function gaEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  gtag?.("event", name, params);
}
