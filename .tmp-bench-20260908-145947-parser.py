#!/usr/bin/env python3
"""Parse FINSEPA_PROVIDER_TRACE log segments into estimated EODHD billed credits."""
import json, re, sys, collections
from pathlib import Path

# EODHD billed credits per request family (official rate-limits doc)
CREDIT = {
    # 1 credit
    "fetchEodhdEodDaily": 1,
    "fetchEodhdEodDailyBothCloses": 1,
    "fetchEodhdCryptoDailyBars": 1,
    "fetchEodhdRealtimeSymbolsRaw": None,  # per symbol
    "fetchEodhdRealtime": 1,
    "fetchEodhdUsQuoteDelayed": 1,
    "fetchEodhdSplits": 1,
    "fetchEodhdDividends": 1,
    "fetchEodhdSearch": 1,
    "fetchEodhdScreener": 1,
    "fetchEodhdEarningsCalendar": 1,
    "fetchEodhdEconomicEvents": 1,
    "fetchEodhdExchangeSymbols": 1,
    "fetchEodhdMacro": 1,
    "fetchEodhdUst": 1,
    # 5 credits
    "fetchEodhdIntraday": 5,
    "fetchEodhdTechnical": 5,
    "fetchEodhdNews": 10,  # 5+5*1 typical single ticker; adjust via meta if present
    "fetchEodhdCompanyNews": 10,
    "fetchStockNews": 10,
    # 10 credits
    "fetchEodhdFundamentals": 10,
    "fetchEodhdFundamentalsJson": 10,
    "fetchEodhdFundamentalsJsonFresh": 10,
    "fetchEodhdFundamentalsJsonUncached": 10,
    "fetchEodhdCryptoFundamentalsMeta": 10,
    "fetchEodhdInsiderTransactions": 10,
    "fetchEodhdInsiderForm4": 10,
}

def credits_for(fn, meta):
    m = meta or {}
    if fn == "fetchEodhdRealtimeSymbolsRaw":
        return int(m.get("symbolsInRequest") or m.get("count") or 1)
    if "News" in fn or fn.endswith("News") or "news" in fn.lower():
        # default single-ticker news = 10 (5+5)
        tickers = m.get("tickers") or m.get("symbols")
        if isinstance(tickers, list):
            return 5 + 5 * len(tickers)
        if isinstance(tickers, int):
            return 5 + 5 * tickers
        return 10
    if "Sentiment" in fn:
        return 10
    if "Fundamentals" in fn or "fundamentals" in fn:
        return 10
    if "Intraday" in fn or "Technical" in fn:
        return 5
    if "Insider" in fn or "Form4" in fn or "Options" in fn:
        return 10
    # bulk
    if "Bulk" in fn:
        n = int(m.get("symbols") or 0)
        return 100 + n
    # known 1-credit map or default 1
    if fn in CREDIT and CREDIT[fn] is not None:
        return CREDIT[fn]
    return 1

TRACE_RE = re.compile(r"\[FINSEPA_PROVIDER_TRACE\] EODHD ([a-zA-Z0-9_]+)(?: (\{.*\}))?$")
SCOPE_RE = re.compile(r"\[FINSEPA_PROVIDER_TRACE\] scope=([^\s]+) eodhd_http=(\d+) byFn=(\{.*\})")
ROUTE_RE = re.compile(r" (GET|POST|PUT|PATCH|DELETE) (/[^\s]+) (\d{3}) in ")
MARKER_RE = re.compile(r"GET /__bench_([^/\s\?]+)")

# Pollution: other browser stock pages not part of journey (update as needed)
POLLUTION_SUBSTR = [
    # Concurrent earnings-IR / other tabs (exclude from credit totals)
    "/stock/AVGO", "/stock/ASML", "/stock/JNJ", "/stock/TSLA", "/stock/TSM",
    "/stock/XOM", "/stock/ORCL", "/stock/TCEHY", "/stock/MU", "/stock/BRK",
    "/stock/LLY", "/stock/UNH", "/stock/ABBV", "/stock/BAC", "/stock/JPM",
    "/stocks/V/", "/stock/V", "\"symbol\":\"V.US\"",
]

def is_pollution(line):
    return any(s in line for s in POLLUTION_SUBSTR)

def parse(path, start_marker=None, end_marker=None):
    text = Path(path).read_text(errors="replace")
    if start_marker:
        i = text.find(f"__bench_{start_marker}")
        text = text[i:] if i >= 0 else text
    if end_marker:
        j = text.find(f"__bench_{end_marker}")
        if j > 0:
            text = text[:j]
    lines = text.splitlines()
    events = []
    scopes = []
    routes = []
    pollution_events = []
    for line in lines:
        mm = MARKER_RE.search(line)
        if mm:
            events.append({"type":"marker","name":mm.group(1)})
        if is_pollution(line):
            tm = TRACE_RE.search(line)
            if tm:
                meta = {}
                if tm.group(2):
                    try: meta = json.loads(tm.group(2))
                    except: pass
                pollution_events.append((tm.group(1), meta, credits_for(tm.group(1), meta)))
            continue
        tm = TRACE_RE.search(line)
        if tm:
            meta = {}
            if tm.group(2):
                try: meta = json.loads(tm.group(2))
                except: pass
            fn = tm.group(1)
            events.append({"type":"eodhd","fn":fn,"meta":meta,"credits":credits_for(fn, meta)})
            continue
        sm = SCOPE_RE.search(line)
        if sm:
            try: byfn = json.loads(sm.group(3))
            except: byfn = {}
            scopes.append({"label":sm.group(1),"http":int(sm.group(2)),"byFn":byfn})
            continue
        rm = ROUTE_RE.search(line)
        if rm:
            routes.append({"method":rm.group(1),"path":rm.group(2).split("?")[0],"status":rm.group(3)})
    return events, scopes, routes, pollution_events

def summarize(events, scopes, routes, pollution_events):
    by_fn = collections.Counter()
    credits = 0
    http = 0
    for e in events:
        if e["type"] != "eodhd": continue
        by_fn[e["fn"]] += 1
        credits += e["credits"]
        http += 1
    route_c = collections.Counter(f"{r['method']} {r['path']}" for r in routes)
    pol_c = sum(c for _,_,c in pollution_events)
    return {
        "eodhd_http": http,
        "est_credits": credits,
        "by_fn": dict(by_fn.most_common()),
        "top_routes": route_c.most_common(20),
        "scopes": scopes,
        "pollution_credits_excluded": pol_c,
        "pollution_http_excluded": len(pollution_events),
    }

if __name__ == "__main__":
    path = sys.argv[1]
    start = sys.argv[2] if len(sys.argv)>2 else None
    end = sys.argv[3] if len(sys.argv)>3 else None
    events, scopes, routes, pollution = parse(path, start, end)
    print(json.dumps(summarize(events, scopes, routes, pollution), indent=2))
