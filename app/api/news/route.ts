import { NextResponse } from "next/server";

import { CACHE_CONTROL_PUBLIC_NEWS_HUB, CACHE_CONTROL_PUBLIC_NEWS_HUB_EMPTY } from "@/lib/data/cache-policy";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getNewsPage } from "@/lib/news/news-feed";
import type { NewsResponse, NewsTab } from "@/lib/news/news-types";
import { isSingleAssetMode } from "@/lib/features/single-asset";

const TABS: NewsTab[] = ["stocks", "crypto", "indices"];

export async function GET(request: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const tabRaw = (url.searchParams.get("tab") ?? "stocks").toLowerCase();
  const tab = (TABS.includes(tabRaw as NewsTab) ? tabRaw : "stocks") as NewsTab;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = 25;

  if (isSingleAssetMode()) {
    const body: NewsResponse = { tab, page, pageSize, total: 0, items: [] };
    return NextResponse.json(body, {
      headers: { "Cache-Control": CACHE_CONTROL_PUBLIC_NEWS_HUB_EMPTY },
    });
  }

  const { total, items } = await getNewsPage(tab, page);

  const body: NewsResponse = { tab, page, pageSize, total, items };
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": CACHE_CONTROL_PUBLIC_NEWS_HUB,
    },
  });
}

