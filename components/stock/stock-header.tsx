import Link from "next/link";
import { Bell, Share2, Plus, Star, ChevronRight, ChevronDown } from "lucide-react";
import { stockData } from "./data";

function ActionButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="border border-[#E4E4E7] bg-white rounded-[10px] h-9 w-9 flex items-center justify-center shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] cursor-pointer hover:bg-[#F4F4F5] transition-colors">
      {children}
    </button>
  );
}

export function StockHeader() {
  const {
    ticker, name, sector, earningsDate, watchlists,
    price, change, changePct, priceTimestamp,
    sentimentBear, sentimentBearCount, sentimentBull, sentimentBullCount,
  } = stockData;

  const isPositive = change >= 0;

  return (
    <div className="space-y-3">
      {/* Row 1: Breadcrumb + Sentiment */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-[14px] text-[#71717A]">
          <Link href="/screener" className="hover:text-[#09090B] transition-colors">Stocks</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-[#09090B] font-medium">PayPal</span>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-[13px] text-[#71717A]">Current sentiment:</span>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-[13px] font-medium text-[#DC2626]">
                🔴 {sentimentBear}% ({sentimentBearCount.toLocaleString()})
              </span>
            </div>
            <div className="w-28 h-2 rounded-full overflow-hidden bg-[#E4E4E7] flex">
              <div className="h-full bg-[#DC2626]" style={{ width: `${sentimentBear}%` }} />
              <div className="h-full bg-[#16A34A]" style={{ width: `${sentimentBull}%` }} />
            </div>
            <span className="text-[13px] font-medium text-[#16A34A]">
              🟢 {sentimentBull}% ({sentimentBullCount.toLocaleString()})
            </span>
          </div>
        </div>
      </div>

      {/* Row 2: Logo + Company info + Actions */}
      <div className="flex items-start justify-between">
        {/* Left: logo + name/subtitle */}
        <div className="flex items-center gap-4">
          {/* PayPal logo placeholder */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#009cde] text-white text-[18px] font-bold shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]">
            P
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[20px] font-semibold leading-7 text-[#09090B]">{name}</h1>
              <span className="text-[14px] font-medium text-[#71717A]">{ticker}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-[#71717A]">
              <span>{sector}</span>
              <span>·</span>
              <span>Q3, {earningsDate}</span>
              <span>·</span>
              <span>{watchlists.toLocaleString()} Watchlists</span>
            </div>
          </div>
        </div>

        {/* Right: action buttons + Buy & Sell */}
        <div className="flex items-center gap-2">
          <ActionButton><Bell className="h-4 w-4 text-[#09090B]" /></ActionButton>
          <ActionButton><Share2 className="h-4 w-4 text-[#09090B]" /></ActionButton>
          <ActionButton><Plus className="h-4 w-4 text-[#09090B]" /></ActionButton>
          <ActionButton>
            <Star className="h-4 w-4 fill-orange-400 text-orange-400" />
          </ActionButton>

          {/* Buy & Sell with dropdown */}
          <div className="flex h-9 overflow-hidden rounded-[10px] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]">
            <button className="bg-[#2563EB] px-4 text-[14px] font-semibold text-white hover:bg-[#1D4ED8] transition-colors">
              Buy &amp; Sell
            </button>
            <button className="flex items-center justify-center border-l border-[#1D4ED8] bg-[#2563EB] px-2 text-white hover:bg-[#1D4ED8] transition-colors">
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Row 3: Price */}
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-[28px] font-semibold leading-9 tabular-nums text-[#09090B]">
            ${price.toFixed(2)}
          </span>
          <span className={`text-[15px] font-medium tabular-nums ${isPositive ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
            {isPositive ? "+" : ""}{change.toFixed(2)} ({isPositive ? "+" : ""}{changePct.toFixed(2)}%)
          </span>
          <span className="text-[13px] text-[#71717A]">Past year</span>
        </div>
        <div className="mt-0.5 text-[12px] text-[#71717A]">{priceTimestamp}</div>
      </div>
    </div>
  );
}
