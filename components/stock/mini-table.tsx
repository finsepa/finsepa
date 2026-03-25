import { ArrowUpDown } from "lucide-react";
import { stockData } from "./data";

const { name, ticker, performance } = stockData;

function PerfCell({ value }: { value: number }) {
  const isPositive = value >= 0;
  return (
    <td className={`text-center text-[14px] leading-5 tabular-nums px-3 py-3 ${
      isPositive ? "text-[#16A34A]" : "text-[#DC2626]"
    }`}>
      {isPositive ? "+" : ""}{value.toFixed(2)}%
    </td>
  );
}

export function MiniTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-t border-b border-[#E4E4E7] bg-white">
            <th className="text-left px-3 py-2.5 min-w-[200px]">
              <div className="flex items-center gap-1.5 text-[14px] font-semibold text-[#71717A]">
                Company
                <ArrowUpDown className="h-3.5 w-3.5" />
              </div>
            </th>
            {["Price","1D","5D","1M","6M","YTD","1Y","5Y","ALL"].map((h) => (
              <th key={h} className="text-center text-[14px] font-semibold text-[#71717A] px-3 py-2.5 min-w-[60px]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-[#E4E4E7]">
            <td className="px-3 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#009cde] text-white text-[11px] font-bold">
                  P
                </div>
                <div>
                  <div className="text-[14px] font-semibold leading-5 text-[#09090B]">{name}</div>
                  <div className="text-[12px] leading-4 text-[#71717A]">{ticker}</div>
                </div>
              </div>
            </td>
            <td className="text-center text-[14px] leading-5 tabular-nums text-[#09090B] px-3 py-3">
              ${performance.price.toFixed(2)}
            </td>
            <PerfCell value={performance.d1} />
            <PerfCell value={performance.d5} />
            <PerfCell value={performance.m1} />
            <PerfCell value={performance.m6} />
            <PerfCell value={performance.ytd} />
            <PerfCell value={performance.y1} />
            <PerfCell value={performance.y5} />
            <PerfCell value={performance.all} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
