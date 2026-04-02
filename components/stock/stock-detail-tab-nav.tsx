"use client";

export type StockDetailTabId = "overview" | "charting" | "peers" | "profile";

const TABS: { id: StockDetailTabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "charting", label: "Charting" },
  { id: "peers", label: "Peers" },
  { id: "profile", label: "Profile" },
];

export function StockDetailTabNav({
  activeTab,
  onTabChange,
}: {
  activeTab: StockDetailTabId;
  onTabChange: (tab: StockDetailTabId) => void;
}) {
  return (
    <div className="border-b border-solid border-[#E4E4E7]">
      <nav className="flex items-start gap-5" aria-label="Stock sections">
        {TABS.map(({ id, label }) => {
          const isActive = id === activeTab;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              className={`-mb-px cursor-pointer border-b-2 border-solid py-2 text-left text-[14px] font-medium leading-6 text-[#09090B] transition-colors ${
                isActive ? "border-[#09090B]" : "border-transparent hover:opacity-80"
              }`}
            >
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export function StockDetailTabPlaceholder({ title, message }: { title: string; message: string }) {
  return (
    <div className="space-y-2 pt-1">
      <h2 className="text-[15px] font-semibold tracking-tight text-[#09090B]">{title}</h2>
      <p className="max-w-md text-[14px] leading-6 text-[#71717A]">{message}</p>
    </div>
  );
}
