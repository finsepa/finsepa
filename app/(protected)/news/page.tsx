import { MarketNewsPage } from "@/components/news/market-news-page";

export default async function News({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <MarketNewsPage searchParams={searchParams} />;
}

