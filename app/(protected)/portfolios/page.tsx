import { PortfoliosDirectoryClient } from "@/components/portfolios/portfolios-directory-client";

export default function PortfoliosPage() {
  return (
    <div className="flex min-h-full flex-col bg-white px-9 py-6">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight text-[#09090B]">Portfolios</h1>
      <PortfoliosDirectoryClient />
    </div>
  );
}
