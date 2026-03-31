import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { fetchMacroSeries5y, MACRO_SERIES, type MacroSeriesDef } from "@/lib/market/eodhd-macro";

type MacroCard = {
  id: string;
  title: string;
  kind: "percent" | "usd" | "index" | "number";
  points: Array<{ time: string; value: number }>;
  latest: { time: string; value: number } | null;
  change: { abs: number; pct: number | null } | null;
};

function latest(points: Array<{ time: string; value: number }>): { time: string; value: number } | null {
  if (!points.length) return null;
  return points[points.length - 1] ?? null;
}

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const country = "USA";

  const settled = await Promise.allSettled(
    MACRO_SERIES.map(async (def: MacroSeriesDef): Promise<MacroCard | null> => {
      const points = await fetchMacroSeries5y(country, def);
      if (!points.length) return null;
      const l = latest(points);
      if (!l) return null;
      const prev = points.length >= 2 ? points[points.length - 2]! : null;
      const abs = prev ? l.value - prev.value : null;
      const pct = prev && prev.value !== 0 ? (abs! / Math.abs(prev.value)) * 100 : null;
      return {
        id: def.id,
        title: def.title,
        kind: def.kind,
        points,
        latest: l,
        change: abs == null ? null : { abs, pct },
      };
    }),
  );

  const items: MacroCard[] = [];
  for (const s of settled) {
    if (s.status === "fulfilled" && s.value) items.push(s.value);
  }

  return NextResponse.json(
    { country, items },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800",
      },
    },
  );
}

