import type { ScreenerSectorRow } from "@/lib/screener/screener-sectors-types";

const colLayout = "grid-cols-[48px_minmax(0,1.6fr)_1fr_1fr] gap-x-2";

function formatPctValue(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

/** Matches {@link ScreenerTable} `ChangeCell` (missing value + color rules). */
function PctCell({ value }: { value: number | null }) {
  if (value == null || !Number.isFinite(value)) {
    return <div className="min-w-0 w-full text-right text-[14px] leading-5 font-medium text-[#71717A]">-</div>;
  }
  const positive = value >= 0;
  return (
    <div
      className={`min-w-0 w-full text-right tabular-nums text-[14px] leading-5 font-medium ${
        positive ? "text-[#16A34A]" : "text-[#DC2626]"
      }`}
    >
      {formatPctValue(value)}
    </div>
  );
}

/**
 * Screener “Sectors” tab — layout/spacing aligned with {@link ScreenerTable} (Web App Design).
 */
export function ScreenerSectorsTable({ rows }: { rows: ScreenerSectorRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[12px] border border-[#E4E4E7] bg-white px-4 py-6 text-center text-[14px] leading-6 text-[#71717A]">
        No sector data is available for the current screener list.
      </div>
    );
  }

  return (
    <div className="divide-y divide-[#E4E4E7] border-t border-b border-[#E4E4E7]">
      <div
        className={`grid ${colLayout} min-h-[44px] items-center bg-white px-4 py-0 text-[14px] font-medium leading-5 text-[#71717A]`}
      >
        <div className="text-center">#</div>
        <div className="text-left">Sector Name</div>
        <div className="min-w-0 w-full text-right">1D %</div>
        <div className="min-w-0 w-full text-right">Market Cap</div>
      </div>

      {rows.map((row) => (
        <div
          key={row.sector}
          className={`grid ${colLayout} h-[60px] max-h-[60px] items-center bg-white px-4 transition-colors duration-75 hover:bg-neutral-50`}
        >
          <div className="text-center text-[14px] font-semibold leading-5 tabular-nums text-[#71717A]">{row.rank}</div>
          <div className="min-w-0 truncate text-[14px] font-semibold leading-5 text-[#09090B]">{row.sector}</div>
          <PctCell value={row.change1D} />
          <div className="min-w-0 w-full text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#09090B]">
            {row.marketCapDisplay}
          </div>
        </div>
      ))}
    </div>
  );
}
