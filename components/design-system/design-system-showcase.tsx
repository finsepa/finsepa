"use client";

import { useState, type ReactNode } from "react";

import { SegmentedControl } from "@/components/design-system/segmented-control";
import { TabSwitcher } from "@/components/design-system/tab-switcher";
import { SecondaryTabs } from "@/components/ui/secondary-tabs";
import { STOCK_CHART_RANGES } from "@/lib/market/stock-chart-types";
import type { StockChartRange } from "@/lib/market/stock-chart-types";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 border-b border-[#E4E4E7] pb-10 last:border-b-0 last:pb-0">
      <div>
        <h2 className="text-[18px] font-semibold leading-7 text-[#09090B]">{title}</h2>
        {description ? <p className="mt-1 max-w-2xl text-[14px] leading-6 text-[#71717A]">{description}</p> : null}
      </div>
      <div className="rounded-[12px] border border-[#E4E4E7] bg-white p-6 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]">
        {children}
      </div>
    </section>
  );
}

export function DesignSystemShowcase() {
  const [metric, setMetric] = useState<"value" | "profit">("value");
  const [rangeScroll, setRangeScroll] = useState<StockChartRange>("1Y");
  const [sizeDemo, setSizeDemo] = useState<"1Y" | "5Y">("1Y");
  const [secondary, setSecondary] = useState<"a" | "b">("a");

  const rangeOptions = STOCK_CHART_RANGES.map((r) => ({ value: r, label: r }));

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <p className="text-[13px] font-medium uppercase tracking-wide text-[#71717A]">Finsepa</p>
        <h1 className="text-[28px] font-semibold leading-9 tracking-tight text-[#09090B]">Component design system</h1>
        <p className="max-w-2xl text-[15px] leading-7 text-[#52525B]">
          Reference implementations for reusable controls. Import from{" "}
          <code className="rounded bg-[#F4F4F5] px-1.5 py-0.5 font-mono text-[13px] text-[#09090B]">
            @/components/design-system
          </code>
          . Product pages are unchanged; use this page when matching Figma specs.
        </p>
      </header>

      <Section
        title="SegmentedControl (Figma Button Group)"
        description="Track and segments use 10px corner radius. Active label: Inter Medium 14px / 20px / #09090B, white surface, elevation shadow. Inactive: regular, zinc-500."
      >
        <div className="space-y-8">
          <div>
            <p className="mb-3 text-[12px] font-medium uppercase tracking-wide text-[#A1A1AA]">Two options</p>
            <SegmentedControl
              aria-label="Demo metric"
              options={[
                { value: "value", label: "Value" },
                { value: "profit", label: "Total profit" },
              ]}
              value={metric}
              onChange={setMetric}
            />
          </div>
          <div>
            <p className="mb-3 text-[12px] font-medium uppercase tracking-wide text-[#A1A1AA]">
              Many options · horizontal scroll on narrow viewports
            </p>
            <div className="overflow-x-auto pb-1">
              <SegmentedControl
                aria-label="Demo chart range"
                options={rangeOptions}
                value={rangeScroll}
                onChange={setRangeScroll}
                className="flex-nowrap"
              />
            </div>
          </div>
          <div>
            <p className="mb-3 text-[12px] font-medium uppercase tracking-wide text-[#A1A1AA]">Small size (md vs sm)</p>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
              <SegmentedControl
                aria-label="Size md"
                options={[
                  { value: "1Y", label: "1Y" },
                  { value: "5Y", label: "5Y" },
                ]}
                value="1Y"
                onChange={() => {}}
                size="md"
              />
              <SegmentedControl
                aria-label="Size sm"
                options={[
                  { value: "1Y", label: "1Y" },
                  { value: "5Y", label: "5Y" },
                ]}
                value={sizeDemo}
                onChange={setSizeDemo}
                size="sm"
              />
            </div>
          </div>
          <div>
            <p className="mb-3 text-[12px] font-medium uppercase tracking-wide text-[#A1A1AA]">Disabled segment</p>
            <SegmentedControl
              aria-label="Demo with disabled"
              options={[
                { value: "a", label: "Active" },
                { value: "b", label: "Disabled", disabled: true },
                { value: "c", label: "Other" },
              ]}
              value="a"
              onChange={() => {}}
            />
          </div>
        </div>
      </Section>

      <Section
        title="TabSwitcher"
        description="Alias of SegmentedControl (md size) used in charting and portfolio toolbars."
      >
        <TabSwitcher
          aria-label="TabSwitcher demo"
          options={[
            { value: "annual", label: "Annual" },
            { value: "quarterly", label: "Quarterly" },
          ]}
          value="annual"
          onChange={() => {}}
        />
      </Section>

      <Section
        title="SecondaryTabs (contrast)"
        description="Separate pattern: spaced pills, active uses grey fill only (no white segment). Use for page-level secondary navigation, not compact button groups."
      >
        <SecondaryTabs
          aria-label="Secondary tabs demo"
          items={[
            { id: "a", label: "Companies" },
            { id: "b", label: "Gainers & Losers" },
          ]}
          value={secondary}
          onValueChange={setSecondary}
        />
      </Section>
    </div>
  );
}
