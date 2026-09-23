#!/usr/bin/env python3
"""Discover IBN, ENLAY, ATLKY IR PDF catalogs (Q1 2022 → latest)."""
from __future__ import annotations

import json
import re
import ssl
import time
import urllib.request
from pathlib import Path
from urllib.parse import unquote

OUT = Path(__file__).resolve().parent
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
CTX = ssl.create_default_context()
IBN_BASE = "https://www.icici.bank.in"
ENEL_DAM = "https://www.enel.com/content/dam/enel-com/documenti/investitori/informazioni-finanziarie"
ENEL_PRESS = "https://www.enel.com/content/dam/enel-common/press/en"
ATLKY_HUB = "https://www.atlascopcogroup.com/en/investors/reports-and-presentations"
ATLKY_DAM = "https://www.atlascopcogroup.com"


def fetch(url: str, timeout: int = 60) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, context=CTX, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def pdf_ok(url: str) -> bool:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Range": "bytes=0-4"})
    try:
        with urllib.request.urlopen(req, context=CTX, timeout=25) as r:
            return r.read(5).startswith(b"%PDF")
    except Exception:
        return False


def dam_url(path: str) -> str:
    return unquote((ATLKY_DAM + path).split("?")[0])


def abs_ibn(href: str) -> str:
    if href.startswith("http"):
        u = href
    else:
        u = IBN_BASE + href
    return unquote(u.split("?")[0])


def quarter_keys_through(end_y: int, end_q: int) -> list[str]:
    keys = []
    y, q = 2022, 1
    while (y, q) <= (end_y, end_q):
        keys.append(f"Q{q} {y}")
        q += 1
        if q > 4:
            q = 1
            y += 1
    return keys


def quarter_color(entry: dict) -> str:
    s, f = entry.get("slides"), entry.get("filings")
    if s and f and s != f:
        return "green"
    if s or f:
        return "yellow"
    return "red"


def verify_catalog(quarters: dict) -> dict:
    ok = bad = 0
    g = y = r = 0
    for entry in quarters.values():
        c = quarter_color(entry)
        if c == "green":
            g += 1
        elif c == "yellow":
            y += 1
        else:
            r += 1
        for k in ("slides", "filings"):
            u = entry.get(k)
            if not u:
                continue
            if pdf_ok(u):
                ok += 1
            else:
                bad += 1
            time.sleep(0.08)
    return {
        "method": "Range-GET bytes=0-4",
        "ok": ok,
        "bad": bad,
        "quarterCounts": {"green": g, "yellow": y, "red": r},
    }


def ticker_light(quarters: dict, verified: dict) -> str:
    if verified["bad"]:
        return "yellow"
    if verified["quarterCounts"]["yellow"] or verified["quarterCounts"]["red"]:
        return "yellow"
    return "green"


def is_icici_subsidiary(path: str) -> bool:
    p = path.lower()
    return any(
        x in p
        for x in (
            "prudential",
            "life-insurance",
            "icicilife",
            "lombard",
            "securities",
            "general-insurance",
            " amc",
            "transcript",
            "opening-remarks",
            "analyst-day",
            "agm-presentation",
            "annual-general",
        )
    )


def classify_icici_path(path: str) -> str | None:
    p = path.lower()
    if "investor" in p and "presentation" in p:
        return "slides"
    if any(x in p for x in ("performance-review", "performance_review", "press-release", "_pr1", "-pr1", "_pr2")):
        return "filings"
    if "financial-results" in p or "financial_results" in p:
        return "filings"
    return None


def parse_icici_qfr() -> dict[str, dict]:
    quarters: dict[str, dict] = {}

    def ensure(q: str) -> dict:
        return quarters.setdefault(q, {"slides": None, "filings": None})

    for year in range(2022, 2027):
        html = fetch(f"{IBN_BASE}/about-us/qfr/{year}")
        # Section-based (handles Q2-2022 bank files without quarter token in filename)
        chunks = re.split(r"(Q[1-4]-\d{4})", html)
        cur_q = None
        for ch in chunks:
            m = re.match(r"Q([1-4])-(\d{4})", ch)
            if m:
                cur_q = f"Q{m.group(1)} {m.group(2)}"
                ensure(cur_q)
                continue
            if not cur_q:
                continue
            for href in re.findall(r'href="([^"]+\.pdf[^"]*)"', ch, re.I):
                if is_icici_subsidiary(href):
                    continue
                if "icici" not in href.lower():
                    continue
                kind = classify_icici_path(href)
                if not kind:
                    continue
                url = abs_ibn(href)
                slot = ensure(cur_q)
                if kind == "slides":
                    slot["slides"] = url
                else:
                    if slot["filings"] is None or "performance" in url.lower() or "_pr1" in url.lower():
                        slot["filings"] = url

        for href in re.findall(r'href="(/content/dam/icicibank[^"]+\.pdf[^"]*)"', html, re.I):
            if is_icici_subsidiary(href):
                continue
            m = re.search(r"Q([1-4])[-_](20\d{2})", href, re.I)
            if not m:
                continue
            qkey = f"Q{m.group(1)} {m.group(2)}"
            kind = classify_icici_path(href)
            if not kind:
                continue
            url = abs_ibn(href)
            slot = ensure(qkey)
            if kind == "slides":
                slot["slides"] = url
            elif slot["filings"] is None or "performance" in url.lower() or "_pr1" in url.lower():
                slot["filings"] = url

    return quarters


def build_ibn() -> dict:
    raw = parse_icici_qfr()
    keys = quarter_keys_through(2027, 1)
    quarters = {k: raw.get(k, {"slides": None, "filings": None}) for k in keys}
    verified = verify_catalog(quarters)
    return {
        "ticker": "IBN",
        "fyEnd": "03-31",
        "irPages": [
            f"{IBN_BASE}/about-us/qfr",
            f"{IBN_BASE}/about-us/investor",
            f"{IBN_BASE}/about-us/invest-relations",
        ],
        "pdfHost": "www.icici.bank.in",
        "trafficLight": ticker_light(quarters, verified),
        "notes": (
            "ICICI Bank Ltd ADR. March FY; issuer labels Q1–Q4 with FY-end year (Q1=Jun, Q4=Mar). "
            "Slides=Investor Presentation; Filings=Performance Review / PR1 press PDF "
            "(exclude subsidiaries/transcripts). Scope Q1 2022→Q1 2027. "
            f"Counts green={verified['quarterCounts']['green']} "
            f"yellow={verified['quarterCounts']['yellow']} "
            f"red={verified['quarterCounts']['red']}. "
            f"Range-GET ok/bad={verified['ok']}/{verified['bad']}."
        ),
        "quarters": quarters,
        "verified": verified,
    }


ENEL_PRESS_BY_QUARTER: dict[str, str] = {
    "Q1 2022": f"{ENEL_PRESS}/2022-may/Enel%20Results%20Q1%202022.pdf",
    "Q2 2022": f"{ENEL_PRESS}/2022-july/Enel%20Results%201H%202022.pdf",
    "Q3 2022": f"{ENEL_PRESS}/2022-november/Enel%20results%209M%202022.pdf",
    "Q4 2022": f"{ENEL_PRESS}/2023-march/Enel%20results%20FY%202022.pdf",
    "Q1 2023": f"{ENEL_PRESS}/2023-may/Enel%20Results%20Q1%202023.pdf",
    "Q2 2023": f"{ENEL_PRESS}/2023-july/Enel%20results%201H%202023.pdf",
    "Q3 2023": f"{ENEL_PRESS}/2023-november/Enel%20results%209M%202023.pdf",
    "Q4 2023": f"{ENEL_PRESS}/2024-march/Enel%20FY%20Results%202023.pdf",
    "Q1 2024": f"{ENEL_PRESS}/2024-may/Enel%20results%201Q%202024.pdf",
    "Q2 2024": f"{ENEL_PRESS}/2024-july/Enel%20Results%201H%202024.pdf",
    "Q3 2024": f"{ENEL_PRESS}/2024-november/Enel%20results%209M%202024.pdf",
    "Q4 2024": f"{ENEL_PRESS}/2025-march/Enel%20FY%20Results%202024.pdf",
    "Q1 2025": f"{ENEL_PRESS}/2025-may/Enel%20results%201Q%202025.pdf",
    "Q2 2025": f"{ENEL_PRESS}/2025-july/Enel%20results%201H%202025.pdf",
    "Q3 2025": f"{ENEL_PRESS}/2025-november/Enel%20results%209M%202025.pdf",
    "Q4 2025": f"{ENEL_PRESS}/2026-march/Enel%20FY%20Results%202025.pdf",
    "Q1 2026": f"{ENEL_PRESS}/2026-may/Enel%20results%201Q%202026.pdf",
}

ENEL_SLIDES_BY_QUARTER: dict[str, str] = {
    "Q1 2022": f"{ENEL_DAM}/2022/trimestrali/1q-2022-risultati.pdf",
    "Q2 2022": f"{ENEL_DAM}/2022/trimestrali/1h-2022-risultati.pdf",
    "Q3 2022": f"{ENEL_DAM}/2022/trimestrali/9m-2022-risultati.pdf",
    "Q4 2022": f"{ENEL_DAM}/2022/trimestrali/fy-2022-risultati.pdf",
    "Q1 2023": f"{ENEL_DAM}/2023/trimestrali/1q-2023-risultati.pdf",
    "Q2 2023": f"{ENEL_DAM}/2023/trimestrali/1h-2023-risultati.pdf",
    "Q3 2023": f"{ENEL_DAM}/2023/trimestrali/9m-2023-risultati.pdf",
    "Q4 2023": f"{ENEL_DAM}/2023/trimestrali/fy-2023-risultati.pdf",
    "Q1 2024": f"{ENEL_DAM}/2024/trimestrali/1q-2024-risultati.pdf",
    "Q2 2024": f"{ENEL_DAM}/2024/trimestrali/1h-2024-risultati.pdf",
    "Q3 2024": f"{ENEL_DAM}/2024/trimestrali/9m-2024-risultati.pdf",
    "Q4 2024": f"{ENEL_DAM}/2024/trimestrali/fy-2024-risultati.pdf",
    "Q1 2025": f"{ENEL_DAM}/2025/trimestrali/1q-2025-risultati.pdf",
    "Q2 2025": f"{ENEL_DAM}/2025/trimestrali/1h-2025-risultati.pdf",
    "Q3 2025": f"{ENEL_DAM}/2025/trimestrali/9m-2025-risultati.pdf",
    "Q4 2025": f"{ENEL_DAM}/2025/trimestrali/fy-2025-risultati.pdf",
    "Q1 2026": f"{ENEL_DAM}/2026/trimestrali/1q-2026-risultati.pdf",
}


def build_enlay() -> dict:
    keys = quarter_keys_through(2026, 2)
    quarters: dict[str, dict] = {}
    for k in keys:
        slides = ENEL_SLIDES_BY_QUARTER.get(k)
        filings = ENEL_PRESS_BY_QUARTER.get(k)
        if slides and not pdf_ok(slides):
            slides = None
        if filings and not pdf_ok(filings):
            filings = None
        quarters[k] = {
            "slides": slides,
            "filings": unquote(filings) if filings else None,
        }
        time.sleep(0.05)

    verified = verify_catalog(quarters)
    return {
        "ticker": "ENLAY",
        "fyEnd": "calendar",
        "irPages": [
            "https://www.enel.com/investors",
            "https://www.enel.com/investors/financial-information",
        ],
        "pdfHost": "www.enel.com",
        "trafficLight": ticker_light(quarters, verified),
        "notes": (
            "Enel SpA ADR. Calendar FY; quarterly packs (1Q/1H/9M/FY). "
            "Slides=*-risultati.pdf on informazioni-finanziarie/trimestrali; "
            "Filings=English press PDF on enel-common/press/en (Enel Results / FY Results). "
            "Reject Quarterly Bulletin (operating data only). Scope Q1 2022→Q2 2026 (1H 2026 TBD). "
            f"Counts green={verified['quarterCounts']['green']} "
            f"yellow={verified['quarterCounts']['yellow']} "
            f"red={verified['quarterCounts']['red']}. "
            f"Range-GET ok/bad={verified['ok']}/{verified['bad']}."
        ),
        "quarters": quarters,
        "verified": verified,
    }


def parse_atlky_from_hub() -> dict[str, dict]:
    html = fetch(ATLKY_HUB)
    paths = sorted(
        set(
            re.findall(
                r"(/content/dam/atlas-copco/group/documents/investors/financial-publications/english/[^\"']+)",
                html,
            )
        )
    )
    quarters: dict[str, dict] = {}
    for p in paths:
        low = p.lower()
        if "annual-report" in low or "capital-markets-day" in low or "key-figures" in low:
            continue
        m = re.search(r"-en-q([1-4])-(20\d{2})-", low) or re.search(r"q([1-4])-(20\d{2})-handout", low)
        if not m:
            continue
        qn, yn = int(m.group(1)), int(m.group(2))
        qkey = f"Q{qn} {yn}"
        slot = quarters.setdefault(qkey, {"slides": None, "filings": None})
        url = dam_url(p)
        if not url.endswith(".pdf"):
            url = url + ".coredownload.pdf"
        if re.search(r"-en-q[1-4]-20\d{2}-[a-z]{2}\.pdf", low) or "-en-q" in low and "handout" not in low and "presentation" not in low and "quarterly-results" not in low:
            if "handout" not in low and "presentation" not in low:
                slot["filings"] = url
        if any(x in low for x in ("handout", "presentation", "quarterly-results-presentation", "quarterly-results-presentations")):
            slot["slides"] = url
    return quarters


def build_atlky() -> dict:
    raw = parse_atlky_from_hub()
    keys = quarter_keys_through(2026, 2)
    quarters = {k: raw.get(k, {"slides": None, "filings": None}) for k in keys}
    verified = verify_catalog(quarters)
    return {
        "ticker": "ATLKY",
        "fyEnd": "calendar",
        "irPages": [ATLKY_HUB, "https://www.atlascopcogroup.com/en/investors"],
        "pdfHost": "www.atlascopcogroup.com",
        "trafficLight": ticker_light(quarters, verified),
        "notes": (
            "Atlas Copco AB ADR (Group site atlascopcogroup.com). Calendar FY; quarterly "
            "interim report PDF (*-en-qN-YYYY-*.pdf) + results presentation/handout. "
            "Slides=presentation/handout; Filings=interim/quarterly report. "
            "Scope Q1 2022→Q2 2026. "
            f"Counts green={verified['quarterCounts']['green']} "
            f"yellow={verified['quarterCounts']['yellow']} "
            f"red={verified['quarterCounts']['red']}. "
            f"Range-GET ok/bad={verified['ok']}/{verified['bad']}."
        ),
        "quarters": quarters,
        "verified": verified,
    }


def main() -> None:
    for name, builder in (
        ("ibn", build_ibn),
        ("enlay", build_enlay),
        ("atlky", build_atlky),
    ):
        cat = builder()
        (OUT / f"{name}-catalog.json").write_text(json.dumps(cat, indent=2) + "\n")
        v = cat["verified"]
        print(
            f"{cat['ticker']} light={cat['trafficLight']} "
            f"g/y/r={v['quarterCounts']['green']}/{v['quarterCounts']['yellow']}/{v['quarterCounts']['red']} "
            f"pdf_ok={v['ok']}/{v['bad']}"
        )


if __name__ == "__main__":
    main()
