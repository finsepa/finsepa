import { keyStats } from "./data";

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[#E4E4E7] last:border-0">
      <span className="text-[14px] leading-5 text-[#09090B] underline decoration-[#E4E4E7] underline-offset-2 cursor-pointer">
        {label}
      </span>
      <span className="text-[14px] leading-5 text-[#09090B] tabular-nums">{value}</span>
    </div>
  );
}

function StatSection({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string }[];
}) {
  return (
    <div className="mb-5 rounded-xl border border-[#E4E4E7] bg-white p-4">
      <h3 className="text-[14px] font-semibold leading-5 text-[#09090B] mb-2">{title}</h3>
      {rows.map((row) => (
        <StatRow key={row.label} label={row.label} value={row.value} />
      ))}
    </div>
  );
}

export function KeyStats({ ticker: _ticker }: { ticker: string }) {
  return (
    <div>
      <h2 className="text-[18px] font-semibold leading-7 text-[#09090B] mb-4">Key Stats</h2>
      <div className="grid grid-cols-3 gap-5">
        {/* Column 1 */}
        <div>
          <StatSection title="Basic" rows={keyStats.basic} />
          <StatSection title="Valuation" rows={keyStats.valuation} />
        </div>

        {/* Column 2 */}
        <div>
          <StatSection title="Revenue & Profit" rows={keyStats.revenue} />
          <StatSection title="Margins" rows={keyStats.margins} />
          <StatSection title="Growth" rows={keyStats.growth} />
        </div>

        {/* Column 3 */}
        <div>
          <StatSection title="Assets & Liabilities" rows={keyStats.assets} />
          <StatSection title="Returns" rows={keyStats.returns} />
          <StatSection title="Dividends" rows={keyStats.dividends} />
          <StatSection title="Risk" rows={keyStats.risk} />
        </div>
      </div>
    </div>
  );
}
