import { StockPageContent } from "@/components/stock/stock-page-content";

type PageProps = {
  params: Promise<{ ticker: string }>;
};

export default async function StockTickerPage({ params }: PageProps) {
  const { ticker } = await params;
  const routeTicker = decodeURIComponent(ticker).trim();

  return <StockPageContent routeTicker={routeTicker} />;
}
