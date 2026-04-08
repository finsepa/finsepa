import { PortfolioPageLoadingShell } from "@/components/portfolio/portfolio-page-loading";

/** Route segment loading — shows immediately on navigation to /portfolio while the page chunk hydrates. */
export default function PortfolioLoading() {
  return <PortfolioPageLoadingShell />;
}
