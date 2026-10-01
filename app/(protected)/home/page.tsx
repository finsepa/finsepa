import { PortfolioHomePage } from "@/components/portfolio-home/portfolio-home-page";

/** Post-signup entry — scaffold overview; easy to replace later. */
export default function HomePage() {
  return (
    <div className="min-w-0 w-full max-w-full max-md:px-4 max-md:pb-2 max-md:pt-0 md:px-9 md:py-6">
      <PortfolioHomePage />
    </div>
  );
}
