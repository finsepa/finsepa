"use client";

import { useState } from "react";
import { StockHeader } from "./stock-header";
import { StockTabs } from "./stock-tabs";
import { ChartControls } from "./chart-controls";
import { StockChart } from "./stock-chart";
import { MiniTable } from "./mini-table";
import { KeyStats } from "./key-stats";
import { LatestNews } from "./latest-news";
import { EventsTab } from "./events-tab";

export function StockPageContent() {
  const [activeTab, setActiveTab] = useState("Overview");

  return (
    <div className="px-9 py-6 space-y-5">
      <StockHeader />
      <StockTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "Overview" && (
        <>
          <ChartControls />
          <StockChart />
          <MiniTable />
          <div className="pt-2"><KeyStats /></div>
          <div className="pt-2"><LatestNews /></div>
        </>
      )}

      {activeTab === "Events" && (
        <EventsTab />
      )}

      {!["Overview", "Events"].includes(activeTab) && (
        <div className="flex h-48 items-center justify-center rounded-xl border border-[#E4E4E7] text-[14px] text-[#71717A]">
          {activeTab} — coming soon
        </div>
      )}
    </div>
  );
}
