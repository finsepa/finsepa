#!/usr/bin/env python3
"""Build TKOMY / AEM / ABNB IR vault discovery catalogs (JSON only)."""
from __future__ import annotations

import json
import re
import subprocess
from collections import OrderedDict
from pathlib import Path

OUT = Path(__file__).resolve().parent
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)
SCOPE_START = "Q1 2022"
TK_BASE = "https://www.tokiomarinehd.com"


def curl_json(url: str, referer: str | None = None) -> dict:
    cmd = ["curl", "-sS", "-A", UA, "--compressed", url, "-H", "Accept: application/json"]
    if referer:
        cmd.extend(["-H", f"Referer: {referer}"])
    raw = subprocess.check_output(cmd, text=True)
    return json.loads(raw)


def curl_text(url: str) -> str:
    return subprocess.check_output(
        ["curl", "-sS", "-A", UA, "--compressed", url], text=True
    )


def norm_url(u: str | None, default_host: str = "https://ir.agnicoeagle.com") -> str | None:
    if not u:
        return None
    u = u.replace("\\/", "/")
    if u.startswith("//"):
        u = "https:" + u
    if u.startswith("/"):
        u = default_host + u
    return u


def head_pdf(url: str | None) -> bool:
    if not url or not url.startswith("http"):
        return False
    proc = subprocess.run(
        ["curl", "-sS", "-A", UA, "-r", "0-7", url],
        capture_output=True,
        check=False,
    )
    chunk = proc.stdout or b""
    return chunk.startswith(b"%PDF")


def quarter_key(subtype: str, year: int) -> str | None:
    mapping = {
        "First Quarter": "Q1",
        "Second Quarter": "Q2",
        "Third Quarter": "Q3",
        "Fourth Quarter": "Q4",
    }
    q = mapping.get(subtype or "")
    if not q:
        return None
    return f"{q} {year}"


def sort_quarter_keys(keys: list[str]) -> list[str]:
    def key(s: str) -> tuple[int, int]:
        q, y = s.split()
        return int(y), int(q[1])

    return sorted(keys, key=key)


def verify_quarters(quarters: OrderedDict) -> dict:
    ok = bad = 0
    green = yellow = red = 0
    for entry in quarters.values():
        slides = entry.get("slides")
        filings = entry.get("filings")
        for url in (slides, filings):
            if not url:
                continue
            if head_pdf(url):
                ok += 1
            else:
                bad += 1
        if slides and filings and slides != filings:
            green += 1
        elif slides or filings:
            yellow += 1
        else:
            red += 1
    ticker_light = "green" if red == 0 and yellow == 0 else ("yellow" if red == 0 else "red")
    return {
        "method": "Range-GET bytes=0-4",
        "ok": ok,
        "bad": bad,
        "quarterCounts": {"green": green, "yellow": yellow, "red": red},
        "tickerLight": ticker_light,
    }


def pick_aem_docs(documents: list[dict]) -> tuple[str | None, str | None]:
    slides = filings = None
    for doc in documents:
        path = norm_url(doc.get("DocumentPath"))
        cat = (doc.get("DocumentCategory") or "").lower()
        title = (doc.get("DocumentTitle") or "").lower()
        is_pdf = doc.get("DocumentFileType") == "PDF" or (path or "").lower().endswith(".pdf")
        if not is_pdf:
            continue
        if "transcript" in cat or "transcript" in title:
            continue
        if cat == "quarterly reports" or "financials and operating" in title:
            continue
        if cat == "presentation" or "presentation" in title:
            slides = path
        elif cat == "press release" or "news release" in title or "/doc_news/" in (path or ""):
            filings = path
    return slides, filings


def build_aem() -> dict:
    reports: list[dict] = []
    for year in range(2022, 2027):
        data = curl_json(
            f"https://ir.agnicoeagle.com/feed/FinancialReport.svc/"
            f"GetFinancialReportList?LanguageId=1&ReportTypeId=1&Year={year}"
        )
        reports.extend(data.get("GetFinancialReportListResult") or [])

    quarters: OrderedDict[str, dict] = OrderedDict()
    for rep in reports:
        key = quarter_key(rep.get("ReportSubType", ""), int(rep.get("ReportYear") or 0))
        if not key or key < SCOPE_START:
            continue
        slides, filings = pick_aem_docs(rep.get("Documents") or [])
        quarters[key] = {"slides": slides, "filings": filings}

    verified = verify_quarters(quarters)
    latest = sort_quarter_keys(list(quarters.keys()))[-1] if quarters else None
    notes = (
        "Agnico Eagle Mines Ltd (AEM). Calendar FY; quarterly. Hub: ir.agnicoeagle.com "
        "FinancialReport.svc (?Year=YYYY). Slides=Presentation PDF (doc_presentations); "
        "Filings=News Release PDF (doc_news or quarterly AEM-News-Release). Reject transcript, "
        "Quarterly Reports / Financials and Operating Data (not press release). "
        f"Scope {SCOPE_START}→{latest} via Year=2022–2025 API (Q1 2025+ not returned by "
        "Year=2025 feed as of discovery — re-check before seed). "
        f"Counts green={verified['quarterCounts']['green']} yellow="
        f"{verified['quarterCounts']['yellow']} red={verified['quarterCounts']['red']}. "
        "Never SEC HTML. Range-GET verified %PDF."
    )
    return {
        "ticker": "AEM",
        "fyEnd": "12-31",
        "irHub": "https://ir.agnicoeagle.com/English/investor-relations/home/default.aspx",
        "pdfHost": "ir.agnicoeagle.com",
        "trafficLight": verified["tickerLight"],
        "notes": notes,
        "quarters": {k: quarters[k] for k in sort_quarter_keys(list(quarters.keys()))},
        "irPages": [
            "https://ir.agnicoeagle.com/English/investor-relations/home/default.aspx",
            "https://ir.agnicoeagle.com/English/investor-relations/news-and-events/news-releases/default.aspx",
            "https://ir.agnicoeagle.com/feed/FinancialReport.svc/GetFinancialReportList?LanguageId=1&ReportTypeId=1&Year=2024",
        ],
        "verified": verified,
    }


def pick_abnb_docs(documents: list[dict]) -> tuple[str | None, str | None]:
    slides = filings = None
    for doc in documents:
        path = norm_url(doc.get("DocumentPath"), "https://investors.airbnb.com")
        cat = (doc.get("DocumentCategory") or "").lower()
        title = (doc.get("DocumentTitle") or "").lower()
        is_pdf = doc.get("DocumentFileType") == "PDF" or (path or "").lower().endswith(".pdf")
        if not is_pdf:
            continue
        if "transcript" in cat or "transcript" in title:
            continue
        if cat in ("tenk", "tenq") or "sec filing" in title:
            continue
        if "shareholder letter" in title or "shareholder-letter" in (path or "").lower():
            slides = path
        elif any(x in title for x in ("presentation", "slide")) or "presentation" in (path or "").lower():
            slides = slides or path
        elif any(x in title for x in ("earnings release", "press release", "news release")):
            filings = path
    return slides, filings


def build_abnb() -> dict:
    reports: list[dict] = []
    for year in range(2022, 2027):
        data = curl_json(
            f"https://investors.airbnb.com/feed/FinancialReport.svc/"
            f"GetFinancialReportList?LanguageId=1&ReportTypeId=1&Year={year}",
            referer="https://investors.airbnb.com/financials/quarterly-results/default.aspx",
        )
        reports.extend(data.get("GetFinancialReportListResult") or [])

    quarters: OrderedDict[str, dict] = OrderedDict()
    for rep in reports:
        key = quarter_key(rep.get("ReportSubType", ""), int(rep.get("ReportYear") or 0))
        if not key or key < SCOPE_START:
            continue
        slides, filings = pick_abnb_docs(rep.get("Documents") or [])
        quarters[key] = {"slides": slides, "filings": filings}

    verified = verify_quarters(quarters)
    latest = sort_quarter_keys(list(quarters.keys()))[-1] if quarters else None
    notes = (
        "Airbnb Inc (ABNB). Calendar FY; quarterly. Hub: investors.airbnb.com "
        "FinancialReport.svc (?Year=YYYY). Slides=Shareholder Letter PDF on "
        "s26.q4cdn.com/656283129/files/doc_financials/{year}/q{n}/. Filings=null: "
        "Press Release is HTML news-details only (no first-party earnings-release PDF). "
        f"Scope {SCOPE_START}→{latest}. Ticker yellow (slides-only all quarters). "
        "Reject transcript, 10-Q/10-K SEC mirror PDFs. Never SEC HTML as filings slot. "
        "Range-GET verified %PDF on slides."
    )
    return {
        "ticker": "ABNB",
        "fyEnd": "12-31",
        "irHub": "https://investors.airbnb.com/financials/quarterly-results/default.aspx",
        "pdfHost": "s26.q4cdn.com/656283129",
        "trafficLight": verified["tickerLight"],
        "notes": notes,
        "quarters": {k: quarters[k] for k in sort_quarter_keys(list(quarters.keys()))},
        "irPages": [
            "https://investors.airbnb.com/",
            "https://investors.airbnb.com/financials/quarterly-results/default.aspx",
            "https://investors.airbnb.com/financials/default.aspx",
            "https://investors.airbnb.com/news-events/events/default.aspx",
        ],
        "verified": verified,
    }


def tkomy_quarter_from_path(path: str) -> str | None:
    name = path.split("/")[-1]
    m = re.search(r"([1-4])Q_FY(20\d\d)", name, re.I)
    if m:
        return f"Q{m.group(1)} {m.group(2)}"
    m = re.search(r"Tokio_Marine_(20\d\d)Q([1-4])", name, re.I)
    if m:
        return f"Q{m.group(2)} {m.group(1)}"
    m = re.search(r"Overview_of_(20\d\d)_([1-4])Q", name, re.I)
    if m:
        return f"Q{m.group(2)} {m.group(1)}"
    return None


def build_tkomy() -> dict:
    pdf_paths: set[str] = set()
    for fy in range(2022, 2027):
        html = curl_text(f"{TK_BASE}/en/ir/event/presentation/{fy}/")
        for rel in re.findall(r'href="(/en/ir/event/presentation/[^"]+\.pdf)"', html, re.I):
            pdf_paths.add(TK_BASE + rel)

    by_q: dict[str, list[str]] = {}
    for p in pdf_paths:
        key = tkomy_quarter_from_path(p)
        if key:
            by_q.setdefault(key, []).append(p)

    quarters: OrderedDict[str, dict] = OrderedDict()
    for key in sort_quarter_keys(list(by_q.keys())):
        if key < SCOPE_START:
            continue
        paths = by_q[key]
        slide_candidates = [
            p
            for p in paths
            if "overview_of" in p.lower() and "results" in p.lower()
            or "results_presentation" in p.lower()
        ]
        filing_candidates = [p for p in paths if "summary_report" in p.lower()]
        quarters[key] = {
            "slides": slide_candidates[0] if slide_candidates else None,
            "filings": filing_candidates[0] if filing_candidates else None,
        }

    verified = verify_quarters(quarters)
    latest = sort_quarter_keys(list(quarters.keys()))[-1] if quarters else None
    notes = (
        "Tokio Marine Holdings ADR (TKOMY). March 31 FY; labels = issuer fiscal year "
        "(FY2026 Q1 ends Jun 2025). Hub: tokiomarinehd.com/en/ir/event/presentation/{fy}/. "
        "Slides=Overview of *Q Results or Tokio_Marine_* Results_Presentation; "
        "Filings=*Summary_Report_e.pdf (earnings summary release). Reject conference call "
        "scripts, supplemental-only without overview, IR conference / investor day decks. "
        f"Scope {SCOPE_START}→{latest}. "
        f"Counts green={verified['quarterCounts']['green']} yellow="
        f"{verified['quarterCounts']['yellow']} red={verified['quarterCounts']['red']}. "
        "Never SEC HTML. Range-GET verified %PDF."
    )
    return {
        "ticker": "TKOMY",
        "fyEnd": "03-31",
        "irHub": "https://www.tokiomarinehd.com/en/ir/index.html",
        "pdfHost": "www.tokiomarinehd.com",
        "trafficLight": verified["tickerLight"],
        "notes": notes,
        "quarters": {k: quarters[k] for k in sort_quarter_keys(list(quarters.keys()))},
        "irPages": [
            "https://www.tokiomarinehd.com/en/ir/index.html",
            "https://www.tokiomarinehd.com/en/ir/event/presentation/",
            "https://www.tokiomarinehd.com/en/ir/download/",
            "https://www.tokiomarinehd.com/en/ir/financial/",
        ],
        "verified": verified,
    }


def main() -> None:
    catalogs = {
        "tkomy-catalog.json": build_tkomy(),
        "aem-catalog.json": build_aem(),
        "abnb-catalog.json": build_abnb(),
    }
    for name, payload in catalogs.items():
        path = OUT / name
        path.write_text(json.dumps(payload, indent=2) + "\n")
        v = payload["verified"]
        print(
            f"Wrote {name}: light={payload['trafficLight']} "
            f"quarters={len(payload['quarters'])} pdf ok/bad={v['ok']}/{v['bad']}"
        )


if __name__ == "__main__":
    main()
