"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

const categories = ["All", "Stocks", "Crypto", "ETF's", "Forex", "Indices", "Bonds", "Economy"];

const results = [
  {
    name: "NVIDIA",
    subtitle: "NVDA",
    type: "stock",
    exchange: "NASDAQ",
    flag: "🇺🇸",
    logo: { bg: "bg-[#76b900]", text: "NV" },
  },
  {
    name: "Apple",
    subtitle: "AAPL",
    type: "stock",
    exchange: "NASDAQ",
    flag: "🇺🇸",
    logo: { bg: "bg-neutral-800", text: "AP" },
  },
  {
    name: "Meta Platforms",
    subtitle: "META",
    type: "stock",
    exchange: "NASDAQ",
    flag: "🇺🇸",
    logo: { bg: "bg-[#0082fb]", text: "ME" },
  },
  {
    name: "BTCUSD",
    subtitle: "Bitcoin / US Dollar",
    type: "spot crypto",
    exchange: "Binance",
    flag: "🟡",
    logo: { bg: "bg-[#f7931a]", text: "BTC" },
  },
  {
    name: "S&P 500",
    subtitle: "SPY",
    type: "index cfd",
    exchange: "SP",
    flag: "🇺🇸",
    logo: { bg: "bg-[#c0392b]", text: "500" },
  },
  {
    name: "Invesco QQQ Trust, Series 1",
    subtitle: "QQQ",
    type: "fund etf",
    exchange: "NASDAQ",
    flag: "🇺🇸",
    logo: { bg: "bg-[#1a56db]", text: "QQQ" },
  },
];

export function SearchModal({ onClose }: { onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/40"
      onClick={onClose}
    >
      {/* Modal */}
      <div
        className="w-full max-w-[640px] mx-4 rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-[#E4E4E7] px-5 py-3.5">
          <Search className="h-5 w-5 shrink-0 text-[#71717A]" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search..."
            className="flex-1 text-[15px] leading-6 text-[#09090B] placeholder:text-[#A1A1AA] outline-none bg-transparent"
          />
          <kbd
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-[#E4E4E7] bg-[#F4F4F5] px-2 py-1 text-[12px] font-medium text-[#71717A] hover:bg-[#E4E4E7] transition-colors select-none"
          >
            ESC
          </kbd>
        </div>

        {/* Category pills */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-[#E4E4E7] overflow-x-auto scrollbar-none">
          {categories.map((cat, i) => (
            <button
              key={cat}
              className={`shrink-0 rounded-full border px-3.5 py-1 text-[13px] font-medium transition-colors ${
                i === 0
                  ? "border-[#2563EB] bg-white text-[#2563EB]"
                  : "border-[#E4E4E7] bg-white text-[#09090B] hover:bg-[#F4F4F5]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="py-2 max-h-[420px] overflow-y-auto">
          {results.map((item) => (
            <Link
              key={item.name}
              href={`/stock/${item.subtitle}`}
              onClick={onClose}
              className="flex items-center gap-4 px-5 py-3 cursor-pointer hover:bg-[#F4F4F5] transition-colors"
            >
              {/* Logo */}
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white text-[11px] font-bold ${item.logo.bg}`}
              >
                {item.logo.text}
              </div>

              {/* Name + ticker */}
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold leading-5 text-[#09090B]">{item.name}</div>
                <div className="text-[12px] leading-4 text-[#71717A]">{item.subtitle}</div>
              </div>

              {/* Type + exchange + flag */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[13px] text-[#71717A]">{item.type}</span>
                <span className="text-[13px] font-medium text-[#09090B]">{item.exchange}</span>
                <span className="text-[18px]">{item.flag}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
