function buildNewsItems(ticker: string) {
  const t = ticker.trim().toUpperCase();
  return [
    {
      id: 1,
      time: "2 hours ago",
      source: "TipsRank",
      headline: `${t} vs peers: What Wall Street is watching this week`,
      excerpt:
        "Macro uncertainty is influencing risk appetite across equities. Here are the catalysts and positioning signals investors are tracking for the week ahead.",
      tags: [t, "EARNINGS", "MACRO"],
    },
    {
      id: 2,
      time: "3 hours ago",
      source: "MarketWatch",
      headline: `${t} price action: key levels and drivers`,
      excerpt:
        "A quick look at recent price moves, volatility, and what could matter next. (Placeholder feed — live news wiring can come later.)",
      tags: [t],
    },
    {
      id: 3,
      time: "9 hours ago",
      source: "Motley Fool",
      headline: `Is it too late to buy ${t}?`,
      excerpt:
        "A long-term view on the business, valuation, and competitive landscape. (Placeholder feed — live news wiring can come later.)",
      tags: [t],
    },
    {
      id: 4,
      time: "14 hours ago",
      source: "Insider Monkey",
      headline: `${t}: where it stands among notable names in the sector`,
      excerpt:
        "We compiled a list of notable stocks in the sector and looked at where this company fits today. (Placeholder feed — live news wiring can come later.)",
      tags: [t],
    },
  ];
}

export function LatestNews({ ticker }: { ticker: string }) {
  const newsItems = buildNewsItems(ticker);
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[18px] font-semibold leading-7 text-[#09090B]">Latest news</h2>
        <div className="flex overflow-hidden rounded-lg border border-[#E4E4E7] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]">
          <button className="bg-[#09090B] px-4 py-1.5 text-[13px] font-medium text-white">News</button>
          <button className="bg-white px-4 py-1.5 text-[13px] font-medium text-[#71717A] hover:bg-[#F4F4F5] transition-colors">Reports</button>
        </div>

      </div>

      {/* News items */}
      <div className="space-y-0">
        {newsItems.map((item) => (
          <div key={item.id} className="flex gap-4 border-b border-[#E4E4E7] py-4 cursor-pointer hover:bg-[#FAFAFA] transition-colors -mx-4 px-4">
            {/* Thumbnail placeholder */}
            <div className="h-[80px] w-[120px] shrink-0 rounded-lg bg-[#F4F4F5] border border-[#E4E4E7] overflow-hidden flex items-center justify-center">
              <div className="text-[#A1A1AA] text-[11px]">📰</div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[12px] text-[#71717A]">{item.time}</span>
                <span className="text-[#E4E4E7]">·</span>
                <span className="text-[12px] font-medium text-[#09090B]">{item.source}</span>
              </div>
              <h3 className="text-[14px] font-semibold leading-5 text-[#09090B] mb-1 line-clamp-2">
                {item.headline}
              </h3>
              <p className="text-[13px] leading-5 text-[#71717A] line-clamp-2 mb-2">
                {item.excerpt}
              </p>
              <div className="flex items-center gap-1.5">
                {item.tags.map((tag) => (
                  <span key={tag} className="rounded-md bg-[#F4F4F5] px-2 py-0.5 text-[12px] font-medium text-[#09090B]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
