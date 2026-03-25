type IndexEntry = {
  name: string;
  value: string;
  change: string;
  trend: number[];
};

const indices: IndexEntry[] = [
  { name: "S&P 500",     value: "5,648.40",  change: "+0.44%", trend: [30,32,29,33,31,34,32,35,34,37,36,38] },
  { name: "Nasdaq 100",  value: "17,713.53", change: "+1.13%", trend: [28,30,27,32,30,33,32,36,34,38,37,40] },
  { name: "Dow Jones",   value: "41,563.08", change: "+0.55%", trend: [32,31,33,30,34,32,35,33,36,35,37,38] },
  { name: "Russell 2000",value: "2,217.63",  change: "+0.67%", trend: [25,27,24,28,26,29,27,30,28,31,30,32] },
  { name: "VIX",         value: "15.00",     change: "-4.15%", trend: [38,36,37,34,35,32,33,30,31,28,27,25] },
];

function MiniSparkline({ points, positive }: { points: number[]; positive: boolean }) {
  const w = 100;
  const h = 40;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const pts = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p - min) / range) * (h - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const polyline = pts.join(" ");
  const fill = `M${pts[0]} L${pts.slice(1).join(" L")} L${w},${h} L0,${h} Z`;
  const stroke = positive ? "#16A34A" : "#DC2626";
  const fillColor = positive ? "rgba(22,163,74,0.1)" : "rgba(220,38,38,0.1)";

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-10 w-full">
      <path d={fill} fill={fillColor} />
      <polyline points={polyline} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function IndexCards() {
  return (
    <div className="mb-6 grid grid-cols-5 gap-6">
      {indices.map(({ name, value, change, trend }) => {
        const positive = !change.startsWith("-");
        return (
          <div
            key={name}
            className="flex flex-col justify-between overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition hover:shadow-md"
          >
            <div className="px-4 pt-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <span className="text-[12px] font-medium text-neutral-500">{name}</span>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                    positive
                      ? "bg-[#F0FDF4] text-[#16A34A]"
                      : "bg-[#FEF2F2] text-[#DC2626]"
                  }`}
                >
                  {change}
                </span>
              </div>
              <div className="text-[22px] font-bold tracking-tight text-neutral-900">
                {value}
              </div>
            </div>
            <div className="px-4 pb-4">
              <MiniSparkline points={trend} positive={positive} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
