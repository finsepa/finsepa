import { respondKeyStatsSectionRoute } from "@/lib/market/stock-key-stats-section-route";

type Ctx = { params: Promise<{ ticker: string }> };

/** @deprecated Use `GET /api/stocks/[ticker]/key-stats-bundle` instead. */
export async function GET(request: Request, { params }: Ctx) {
  return respondKeyStatsSectionRoute(request, params, "basic");
}
