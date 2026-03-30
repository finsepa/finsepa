"use client";

export type StockDetailTabId = "overview" | "charting" | "profile";

const TABS: { id: StockDetailTabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "charting", label: "Charting" },
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
    <div className="border-b border-[#E4E4E7]">
      <nav className="flex items-center gap-8" aria-label="Stock sections">
        {TABS.map(({ id, label }) => {
          const isActive = id === activeTab;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              className={`cursor-pointer border-b-2 pb-2.5 text-[14px] leading-5 transition-colors -mb-px ${
                isActive
                  ? "border-[#09090B] font-semibold text-[#09090B]"
                  : "border-transparent font-medium text-[#71717A] hover:text-[#09090B]"
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
