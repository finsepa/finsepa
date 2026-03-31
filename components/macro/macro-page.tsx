"use client";

import { useEffect, useMemo, useState } from "react";

import { SkeletonBox } from "@/components/markets/skeleton";
import { MacroCard, type MacroCardModel } from "@/components/macro/macro-card";

type MacroApiResponse = {
  country: string;
  items: MacroCardModel[];
};

function MacroGridSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-[16px] border border-[#E4E4E7] bg-white px-4 py-4">
          <div className="space-y-2">
            <SkeletonBox className="h-4 w-40 rounded-md" />
            <div className="flex items-baseline gap-2">
              <SkeletonBox className="h-6 w-24 rounded-md" />
              <SkeletonBox className="h-4 w-28 rounded-md" />
            </div>
          </div>
          <div className="mt-4">
            <SkeletonBox className="h-32 w-full rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MacroPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MacroCardModel[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/macro", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) {
            setItems([]);
            setError("Failed to load macro data.");
          }
          return;
        }
        const json = (await res.json()) as MacroApiResponse;
        if (cancelled) return;
        setItems(Array.isArray(json.items) ? json.items : []);
      } catch {
        if (!cancelled) {
          setItems([]);
          setError("Failed to load macro data.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => a.title.localeCompare(b.title));
  }, [items]);

  return (
    <div className="space-y-5 px-9 py-6">
      <div className="space-y-1">
        <h1 className="text-[20px] font-semibold tracking-tight text-[#09090B]">Macro</h1>
      </div>

      {loading ? (
        <MacroGridSkeleton />
      ) : error ? (
        <div className="rounded-[12px] border border-[#E4E4E7] bg-white px-4 py-4 text-sm text-[#71717A]">
          {error}
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-[12px] border border-[#E4E4E7] bg-white px-4 py-4 text-sm text-[#71717A]">
          No macro data available from EODHD right now.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((m) => (
            <MacroCard key={m.id} model={m} />
          ))}
        </div>
      )}
    </div>
  );
}

