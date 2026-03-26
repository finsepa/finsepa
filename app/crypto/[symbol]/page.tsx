import { CryptoPageContent } from "@/components/crypto/crypto-page-content";

type PageProps = {
  params: Promise<{ symbol: string }>;
};

export default async function CryptoSymbolPage({ params }: PageProps) {
  const { symbol } = await params;
  const routeSymbol = decodeURIComponent(symbol).trim().toUpperCase();
  return <CryptoPageContent routeSymbol={routeSymbol} />;
}

