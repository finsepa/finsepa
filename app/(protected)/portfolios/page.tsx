import { PortfoliosDirectoryClient } from "@/components/portfolios/portfolios-directory-client";

export default function PortfoliosPage() {
  return (
    <div className="flex min-h-full min-w-0 flex-col bg-white px-4 py-4 sm:px-9 sm:py-6">
      <PortfoliosDirectoryClient />
    </div>
  );
}
