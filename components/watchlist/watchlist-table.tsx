"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, MoreHorizontal, Trash2, Settings2, Plus, ArrowUpDown } from "lucide-react";

type WatchlistRow = {
  name: string;
  ticker: string;
  price: string;
  d1: string; d7: string; m1: string; ytd: string;
  mcap: string; pe: string; earnings: string;
  logo: { bg: string; text: string };
  d1pos: boolean; d7pos: boolean; m1pos: boolean; ytdpos: boolean;
};

type Group = { label: string; rows: WatchlistRow[] };

const groups: Group[] = [
  {
    label: "Finance",
    rows: [
      { name: "Blackrock",           ticker: "BLK",  price: "$901.81",    d1: "+0.36%", d7: "-0.78%", m1: "-0.78%", ytd: "-0.78%",  mcap: "$133.58 B", pe: "34.35", earnings: "Oct 31, 2024", logo: { bg: "bg-neutral-800",  text: "BR" }, d1pos: true,  d7pos: false, m1pos: false, ytdpos: false },
      { name: "JP Morgan Chase & Co.",ticker: "JPM",  price: "$224.80",    d1: "+0.18%", d7: "-0.78%", m1: "-3.96%", ytd: "-3.96%",  mcap: "$639.59 B", pe: "72.85", earnings: "Oct 31, 2024", logo: { bg: "bg-[#1a3a6b]",   text: "JP" }, d1pos: true,  d7pos: false, m1pos: false, ytdpos: false },
      { name: "Moody's",             ticker: "MCO",  price: "$487.74",    d1: "+0.05%", d7: "-0.78%", m1: "+0.05%", ytd: "+0.05%",  mcap: "$34.3 B",   pe: "23.38", earnings: "Oct 31, 2024", logo: { bg: "bg-[#0033a0]",   text: "MC" }, d1pos: true,  d7pos: false, m1pos: true,  ytdpos: true  },
    ],
  },
  {
    label: "Consumer Defensive",
    rows: [
      { name: "Costco",  ticker: "COST", price: "$892.38",  d1: "+1.02%", d7: "+0.87%", m1: "-3.85%", ytd: "-3.85%", mcap: "$395.62 B", pe: "55.26", earnings: "Oct 31, 2024", logo: { bg: "bg-[#e8002d]",  text: "CO" }, d1pos: true, d7pos: true, m1pos: false, ytdpos: false },
      { name: "PepsiCo", ticker: "PEP",  price: "$172.88",  d1: "+1.02%", d7: "+0.87%", m1: "-3.85%", ytd: "-3.85%", mcap: "237.46 B",  pe: "25.06", earnings: "Oct 31, 2024", logo: { bg: "bg-[#004b93]",  text: "PE" }, d1pos: true, d7pos: true, m1pos: false, ytdpos: false },
    ],
  },
  {
    label: "Tech",
    rows: [
      { name: "Apple",  ticker: "AAPL", price: "$207.23", d1: "+1.02%", d7: "+0.87%", m1: "-3.85%", ytd: "-3.85%", mcap: "$3.318 T", pe: "32.3",  earnings: "Oct 31, 2024", logo: { bg: "bg-neutral-800", text: "AP" }, d1pos: true, d7pos: true, m1pos: false, ytdpos: false },
      { name: "NVIDIA", ticker: "NVDA", price: "$123.61", d1: "+0.24%", d7: "+0.87%", m1: "+0.05%", ytd: "+0.05%", mcap: "$2.928 T", pe: "42.16", earnings: "Oct 31, 2024", logo: { bg: "bg-[#76b900]",    text: "NV" }, d1pos: true, d7pos: true, m1pos: true,  ytdpos: true  },
    ],
  },
  {
    label: "Crypto",
    rows: [
      { name: "Bitcoin",  ticker: "BTC", price: "$61,039.36", d1: "+0.26%", d7: "-0.44%", m1: "+12.13%", ytd: "+38.20%", mcap: "$1.20 T",   pe: "-", earnings: "-", logo: { bg: "bg-[#f7931a]", text: "BT" }, d1pos: true, d7pos: false, m1pos: true, ytdpos: true },
      { name: "Ethereum", ticker: "ETH", price: "$2,416.07",  d1: "+1.36%", d7: "+1.68%", m1: "+9.9%",   ytd: "+2.71%",  mcap: "$290.83 B", pe: "-", earnings: "-", logo: { bg: "bg-[#627eea]", text: "ET" }, d1pos: true, d7pos: true,  m1pos: true, ytdpos: true },
    ],
  },
];

function ChangeCell({ value, positive }: { value: string; positive?: boolean }) {
  if (value === "-") return (
    <td className="px-4 text-center text-[14px] leading-5 tabular-nums text-[#71717A]">-</td>
  );
  if (positive === undefined) return (
    <td className="px-4 text-center text-[14px] leading-5 tabular-nums text-[#09090B]">{value}</td>
  );
  return (
    <td className={`px-4 text-center text-[14px] leading-5 tabular-nums font-medium ${positive ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
      {value}
    </td>
  );
}

function GroupSection({ group }: { group: Group }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Group header */}
      <tr className="border-b border-[#E4E4E7]">
        <td colSpan={11} className="px-4 py-2 bg-white">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex items-center gap-2 text-[13px] font-medium text-[#71717A] hover:text-[#09090B] transition-colors"
            >
              {collapsed
                ? <ChevronRight className="h-4 w-4" />
                : <ChevronDown className="h-4 w-4" />}
              {group.label}
            </button>
            <button className="text-[#71717A] hover:text-[#09090B] transition-colors">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>

      {/* Data rows */}
      {!collapsed && group.rows.map((row) => (
        <tr
          key={row.ticker}
          className="group h-[60px] max-h-[60px] border-b border-[#E4E4E7] transition-colors duration-75 hover:bg-neutral-50 last:border-b-0 cursor-pointer"
        >
          {/* Checkbox */}
          <td className="w-10 px-4">
            <div className="h-4 w-4 rounded border border-[#E4E4E7] bg-white" />
          </td>

          {/* Company */}
          <td className="py-0 pr-4">
            <Link href={`/stock/${encodeURIComponent(row.ticker)}`} className="flex items-center gap-3">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white ${row.logo.bg}`}>
                {row.logo.text}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B]">{row.name}</div>
                <div className="text-[12px] font-normal leading-4 text-[#71717A]">{row.ticker}</div>
              </div>
            </Link>
          </td>

          {/* Price */}
          <td className="px-4 text-center text-[14px] leading-5 font-normal tabular-nums text-[#09090B]">
            {row.price}
          </td>

          <ChangeCell value={row.d1}  positive={row.d1pos} />
          <ChangeCell value={row.d7}  positive={row.d7pos} />
          <ChangeCell value={row.m1}  positive={row.m1pos} />
          <ChangeCell value={row.ytd} positive={row.ytdpos} />

          {/* M.Cap */}
          <td className="px-4 text-center text-[14px] leading-5 font-normal tabular-nums text-[#09090B]">{row.mcap}</td>
          {/* PE */}
          <td className="px-4 text-center text-[14px] leading-5 font-normal tabular-nums text-[#09090B]">{row.pe}</td>
          {/* Earnings */}
          <td className="px-4 text-center text-[14px] leading-5 font-normal text-[#09090B]">{row.earnings}</td>

          {/* Delete — shows on hover */}
          <td className="w-10 px-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <button className="text-[#71717A] hover:text-[#DC2626] transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          </td>
        </tr>
      ))}
    </>
  );
}

export function WatchlistTable() {
  return (
    <div className="flex flex-col gap-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-[20px] font-semibold leading-7 text-[#09090B]">Core Watchlist</h1>
          <ChevronDown className="h-5 w-5 text-[#71717A]" />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-[#E4E4E7] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]">
            <button type="button" className="bg-[#F4F4F5] px-4 py-1.5 text-[13px] font-medium text-[#09090B] transition-colors hover:bg-[#EBEBEB]">
              Performance
            </button>
            <button type="button" className="border-l border-[#E4E4E7] bg-white px-4 py-1.5 text-[13px] font-medium text-[#71717A] transition-colors hover:bg-[#F4F4F5]">
              Fundamentals
            </button>
          </div>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-[#E4E4E7] bg-white px-3 py-1.5 text-[13px] font-medium text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-colors hover:bg-[#F4F4F5]"
          >
            <Settings2 className="h-4 w-4" />
            Customize
          </button>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-[#E4E4E7] bg-white px-3 py-1.5 text-[13px] font-medium text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-colors hover:bg-[#F4F4F5]"
          >
            <Plus className="h-4 w-4" />
            New Asset
          </button>
        </div>
      </div>

      {/* Table */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-t border-b border-[#E4E4E7] bg-white">
            <th className="w-10 px-4 py-3" />
            <th className="py-3 pr-4 text-left">
              <div className="flex items-center gap-1.5 text-[14px] font-semibold leading-5 text-[#71717A]">
                Company <ArrowUpDown className="h-3.5 w-3.5" />
              </div>
            </th>
            {["Price","1D %","7D %","1M %","YTD %","M.Cap","PE","Earnings"].map((h) => (
              <th key={h} className="px-4 py-3 text-center text-[14px] font-semibold leading-5 text-[#71717A]">{h}</th>
            ))}
            <th className="w-10 px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => <GroupSection key={g.label} group={g} />)}
        </tbody>
      </table>
    </div>
  );
}
