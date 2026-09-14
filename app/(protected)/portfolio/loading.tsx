import { PortfolioPageLoadingShell } from "@/components/portfolio/portfolio-page-loading";

/** Soft-nav into `/portfolio` — same shell as page Suspense fallback. */
export default function PortfolioLoading() {
  return <PortfolioPageLoadingShell />;
}
