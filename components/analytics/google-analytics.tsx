import Script from "next/script";

import { GA_MEASUREMENT_ID } from "@/lib/analytics/google-analytics";

const GA_INIT = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}');`;

/** Render inside `<head>`: `gtag` must exist before hydration so early client events are queued, not dropped. */
export function GoogleAnalytics() {
  if (process.env.VERCEL_ENV !== "production") return null;

  return (
    <>
      <script id="ga-init" dangerouslySetInnerHTML={{ __html: GA_INIT }} />
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
    </>
  );
}
