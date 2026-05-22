import { PublicPortfolioPageClient } from "@/components/portfolios/public-portfolio-page-client";

type PageProps = { params: Promise<{ listingId: string }> };

export default async function PublicPortfolioDetailPage({ params }: PageProps) {
  const { listingId } = await params;
  return <PublicPortfolioPageClient listingId={listingId} />;
}
