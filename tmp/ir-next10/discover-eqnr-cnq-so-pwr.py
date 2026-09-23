#!/usr/bin/env python3
"""Discover EQNR / CNQ / SO / PWR IR earnings PDF catalogs."""
from __future__ import annotations

import json
import re
import ssl
import subprocess
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

OUT = Path("/Users/rakshamann/Desktop/Finsepa/tmp/ir-next10")
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)
CTX = ssl.create_default_context()


def curl_fetch(url: str, referer: str | None = None, timeout: int = 60) -> bytes:
    cmd = [
        "curl",
        "-sL",
        "--max-time",
        str(timeout),
        "-A",
        UA,
        "--tlsv1.2",
    ]
    if referer:
        cmd.extend(["-H", f"Referer: {referer}"])
    cmd.extend(["-H", "Accept: */*"])
    cmd.append(url)
    return subprocess.check_output(cmd)


def fetch(url: str, referer: str | None = None, timeout: int = 45) -> tuple[int, bytes]:
    headers = {"User-Agent": UA, "Accept": "*/*"}
    if referer:
        headers["Referer"] = referer
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, context=CTX, timeout=timeout) as r:
            return r.status, r.read()
    except Exception as e:
        try:
            return 200, curl_fetch(url, referer=referer, timeout=timeout)
        except Exception as e2:
            print(f"FETCH FAIL {url}: {e} / curl: {e2}")
            return 0, b""


def head_pdf(url: str) -> bool:
    cmd = [
        "curl",
        "-sI",
        "-A",
        UA,
        "-H",
        "Range: bytes=0-4",
        url,
    ]
    try:
        out = subprocess.check_output(cmd, stderr=subprocess.DEVNULL).decode("utf-8", "replace")
        if "200" in out or "206" in out:
            # also GET first bytes
            data = curl_fetch(url)[:5]
            return data.startswith(b"%PDF")
    except Exception:
        pass
    req = urllib.request.Request(
        url, method="GET", headers={"User-Agent": UA, "Range": "bytes=0-7"}
    )
    try:
        with urllib.request.urlopen(req, context=CTX, timeout=30) as r:
            return r.read(5).startswith(b"%PDF")
    except Exception:
        return False


class HrefParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hrefs: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() != "a":
            return
        d = dict(attrs)
        href = d.get("href")
        if href:
            self.hrefs.append(href)


def all_hrefs(html: str) -> list[str]:
    p = HrefParser()
    try:
        p.feed(html)
    except Exception:
        pass
    p.hrefs.extend(re.findall(r'href=["\']([^"\']+)["\']', html, re.I))
    p.hrefs.extend(re.findall(r'"(https?://[^"]+\.pdf[^"]*)"', html, re.I))
    p.hrefs.extend(re.findall(r"'(https?://[^']+\.pdf[^']*)'", html, re.I))
    return p.hrefs


def parse_q4_api(raw: bytes) -> list[dict]:
    if raw[:1] != b"{" and raw[:1] != b"[":
        return []
    j = json.loads(raw)
    if isinstance(j, dict):
        for k in ("GetFinancialReportListResult", "d", "Data", "data"):
            if k in j:
                j = j[k]
                break
    if isinstance(j, dict) and "Data" in j:
        j = j["Data"]
    return j if isinstance(j, list) else []


def q4_financial_list(base: str, referer: str) -> list[dict]:
    for path in (
        "/feed/FinancialReport.svc/GetFinancialReportList",
        "/services/FinancialReport.svc/GetFinancialReportList",
    ):
        url = base.rstrip("/") + path
        _, raw = fetch(
            url,
            referer=referer,
            timeout=90,
        )
        if raw[:1] in (b"{", b"["):
            items = parse_q4_api(raw)
            if items:
                print(f"  q4 API {url} -> {len(items)} items")
                return items
    return []


def collect_pdfs_from_pages(pages: list[str], base: str) -> list[str]:
    pdfs: set[str] = set()
    for page in pages:
        _, data = fetch(page, referer=base)
        if not data:
            continue
        html = data.decode("utf-8", "replace")
        for href in all_hrefs(html):
            if ".pdf" not in href.lower():
                continue
            pdfs.add(urllib.parse.urljoin(page, href))
        for m in re.findall(r'https?://[^\s"\'<>]+\.pdf', html, re.I):
            pdfs.add(m.replace("\\/", "/"))
        for m in re.findall(r'//s\d+\.q4cdn\.com/[^\s"\'<>]+\.pdf', html, re.I):
            pdfs.add("https:" + m.replace("\\/", "/"))
    return sorted(pdfs)


def quarter_key_from_text(text: str) -> str | None:
    t = text.upper()
    # Q1 2022 style
    m = re.search(r"\bQ([1-4])\s*['\u2019]?\s*(20\d{2})\b", t)
    if m:
        return f"Q{m.group(1)} {m.group(2)}"
    m = re.search(r"\b(20\d{2})\s*Q([1-4])\b", t)
    if m:
        return f"Q{m.group(2)} {m.group(1)}"
    m = re.search(r"\b([1-4])Q\s*(20\d{2})\b", t, re.I)
    if m:
        return f"Q{m.group(1)} {m.group(2)}"
    m = re.search(r"\b(1ST|2ND|3RD|4TH)\s+QUARTER\s+(20\d{2})\b", t)
    if m:
        qmap = {"1ST": "1", "2ND": "2", "3RD": "3", "4TH": "4"}
        return f"Q{qmap[m.group(1)]} {m.group(2)}"
    return None


def classify_url(url: str, title: str = "") -> str | None:
    blob = (url + " " + title).lower()
    if any(x in blob for x in ["10-q", "10-k", "8-k", "proxy", "annual-report", "sustainability"]):
        return None
    slide_hints = [
        "presentation",
        "slide",
        "deck",
        "supplement",
        "overview",
        "investor-presentation",
        "earnings-presentation",
        "call-presentation",
        "charts",
    ]
    filing_hints = [
        "earnings-release",
        "press-release",
        "news-release",
        "operating-results",
        "financial-results",
        "earnings press",
        "release-final",
        "exhibit-99",
        "ex99",
    ]
    is_slide = any(h in blob for h in slide_hints)
    is_filing = any(h in blob for h in filing_hints)
    if "release" in blob and "presentation" in blob:
        if "presentation" in url.lower().split("/")[-1]:
            is_slide = True
        elif "release" in url.lower().split("/")[-1]:
            is_filing = True
    if is_slide and not is_filing:
        return "slides"
    if is_filing and not is_slide:
        return "filings"
    if is_slide and is_filing:
        if "presentation" in blob:
            return "slides"
        return "filings"
    if "doc_presentations" in blob or "presentation" in blob.split("/")[-1]:
        return "slides"
    if "doc_news" in blob or "doc_financials" in blob:
        if "presentation" in blob:
            return "slides"
        if "release" in blob or "press" in blob or "news" in blob:
            return "filings"
    return None


def map_q4_items(items: list[dict]) -> dict[str, dict[str, str | None]]:
    quarters: dict[str, dict[str, str | None]] = {}
    for it in items:
        title = it.get("Title") or it.get("DocumentTitle") or ""
        url = it.get("DocumentPath") or it.get("Url") or ""
        if not url or ".pdf" not in url.lower():
            continue
        qk = quarter_key_from_text(title + " " + url)
        if not qk:
            continue
        kind = classify_url(url, title)
        if not kind:
            continue
        y = int(qk.split()[1])
        if y < 2022 or (y == 2022 and qk.startswith("Q") and int(qk[1]) < 1):
            continue
        quarters.setdefault(qk, {"slides": None, "filings": None})
        cur = quarters[qk][kind]
        if cur is None:
            quarters[qk][kind] = url
    return quarters


def map_pdf_list(pdfs: list[str]) -> dict[str, dict[str, str | None]]:
    quarters: dict[str, dict[str, str | None]] = {}
    for url in pdfs:
        fname = urllib.parse.unquote(url.split("/")[-1])
        qk = quarter_key_from_text(fname + " " + url)
        if not qk:
            continue
        kind = classify_url(url, fname)
        if not kind:
            continue
        y = int(qk.split()[1])
        if y < 2022:
            continue
        quarters.setdefault(qk, {"slides": None, "filings": None})
        if quarters[qk][kind] is None:
            quarters[qk][kind] = url
    return quarters


def ordered_quarters(q: dict) -> list[str]:
    def key(s):
        qn, yr = s.split()
        return (int(yr), int(qn[1]))

    return sorted(q.keys(), key=key)


def verify_catalog(quarters: dict) -> dict:
    ok = bad = 0
    g = y = r = 0
    for qk, slot in quarters.items():
        s, f = slot.get("slides"), slot.get("filings")
        has_s = bool(s)
        has_f = bool(f)
        if has_s and has_f and s != f:
            g += 1
        elif has_s or has_f:
            y += 1
        else:
            r += 1
        for u in (s, f):
            if not u:
                continue
            if head_pdf(u):
                ok += 1
            else:
                bad += 1
                print(f"  BAD PDF {qk}: {u}")
    return {
        "method": "Range-GET bytes=0-4",
        "ok": ok,
        "bad": bad,
        "quarterCounts": {"green": g, "yellow": y, "red": r},
    }


def traffic_light(verified: dict) -> str:
    qc = verified["quarterCounts"]
    if qc["yellow"] == 0 and qc["red"] == 0 and qc["green"] > 0:
        return "green"
    if qc["green"] == 0 and qc["yellow"] == 0:
        return "red"
    return "yellow"


def discover_so() -> dict:
    base = "https://investor.southerncompany.com"
    referer = f"{base}/financial-information/quarterly-earnings"
    items = q4_financial_list(base, referer)
    quarters = map_q4_items(items)
    if not quarters:
        pages = [
            referer,
            f"{base}/financial-information/quarterly-earnings/default.aspx",
            f"{base}/news-events/press-releases",
        ]
        for y in range(2022, 2027):
            pages.append(f"{base}/financial-information/quarterly-earnings/{y}")
        pdfs = collect_pdfs_from_pages(pages, base)
        print(f"  SO fallback pdfs: {len(pdfs)}")
        quarters = map_pdf_list(pdfs)
    # fill scope Q1 2022 -> latest present
    verified = verify_catalog(quarters)
    return {
        "ticker": "SO",
        "fyEnd": "12-31",
        "irPages": [
            base,
            referer,
            f"{base}/news-events/press-releases",
        ],
        "pdfHost": "s27.q4cdn.com/273397814",
        "trafficLight": traffic_light(verified),
        "notes": (
            "Southern Company calendar utility FY. IR hub investor.southerncompany.com; "
            "PDFs on s27.q4cdn.com/273397814. Slides=Earnings Presentation; "
            "Filings=Earnings/Press Release PDF. Never SEC HTML."
        ),
        "quarters": {k: quarters[k] for k in ordered_quarters(quarters)},
        "verified": verified,
    }


def discover_pwr() -> dict:
    base = "https://investors.quantaservices.com"
    referer = f"{base}/financial-information/quarterly-results"
    items = q4_financial_list(base, referer)
    quarters = map_q4_items(items)
    pages = [referer, f"{base}/news-events/press-releases"]
    for y in range(2022, 2027):
        pages.append(f"{base}/financial-information/quarterly-results/{y}")
    pdfs = collect_pdfs_from_pages(pages, base)
    print(f"  PWR page pdfs: {len(pdfs)}")
    q2 = map_pdf_list(pdfs)
    for k, v in q2.items():
        quarters.setdefault(k, {"slides": None, "filings": None})
        for kind in ("slides", "filings"):
            if quarters[k][kind] is None and v.get(kind):
                quarters[k][kind] = v[kind]
    verified = verify_catalog(quarters)
    host = "q4cdn TBD"
    for q in quarters.values():
        for u in (q.get("slides"), q.get("filings")):
            if u and "q4cdn.com" in u:
                m = re.search(r"(s\d+\.q4cdn\.com/\d+)", u)
                if m:
                    host = m.group(1)
                    break
    return {
        "ticker": "PWR",
        "fyEnd": "12-31",
        "irPages": [base, referer],
        "pdfHost": host,
        "trafficLight": traffic_light(verified),
        "notes": "Quanta Services calendar FY. investors.quantaservices.com + q4cdn.",
        "quarters": {k: quarters[k] for k in ordered_quarters(quarters)},
        "verified": verified,
    }


def discover_cnq() -> dict:
    base = "https://www.cnrl.com"
    pages = [
        f"{base}/investors/",
        f"{base}/investors/investor-presentations/",
        f"{base}/investors/news-releases/",
        f"{base}/investors/quarterly-results/",
    ]
    for y in range(2022, 2027):
        pages.append(f"{base}/investors/quarterly-results/{y}/")
    pdfs = collect_pdfs_from_pages(pages, base)
    print(f"  CNQ pdfs: {len(pdfs)}")
    quarters = map_pdf_list(pdfs)
    verified = verify_catalog(quarters)
    return {
        "ticker": "CNQ",
        "fyEnd": "12-31",
        "irPages": pages[:5],
        "pdfHost": "cnrl.com/wp-content or CDN from crawl",
        "trafficLight": traffic_light(verified),
        "notes": "Canadian Natural Resources calendar FY. cnrl.com/investors.",
        "quarters": {k: quarters[k] for k in ordered_quarters(quarters)},
        "verified": verified,
    }


def discover_eqnr() -> dict:
    base = "https://www.equinor.com"
    referer = f"{base}/investors/results-and-reports"
    items = q4_financial_list(base, referer)
    quarters = map_q4_items(items)
    pages = [
        referer,
        f"{base}/investors/results-and-reports/quarterly-results",
        f"{base}/investors/results-and-reports/annual-reports-and-sustainability",
        f"{base}/investors/events-and-presentations",
    ]
    pdfs = collect_pdfs_from_pages(pages, base)
    print(f"  EQNR page pdfs: {len(pdfs)}")
    q2 = map_pdf_list(pdfs)
    for k, v in q2.items():
        quarters.setdefault(k, {"slides": None, "filings": None})
        for kind in ("slides", "filings"):
            if quarters[k][kind] is None and v.get(kind):
                quarters[k][kind] = v[kind]
    verified = verify_catalog(quarters)
    return {
        "ticker": "EQNR",
        "fyEnd": "12-31",
        "irPages": pages,
        "pdfHost": "equinor.com CDN / q4 if present",
        "trafficLight": traffic_light(verified),
        "notes": "Equinor ASA ADR calendar FY. equinor.com/investors.",
        "quarters": {k: quarters[k] for k in ordered_quarters(quarters)},
        "verified": verified,
    }


def main():
    for fn, name in [
        (discover_eqnr, "eqnr"),
        (discover_cnq, "cnq"),
        (discover_so, "so"),
        (discover_pwr, "pwr"),
    ]:
        print(f"\n======== {name.upper()} ========")
        cat = fn()
        path = OUT / f"{name}-catalog.json"
        path.write_text(json.dumps(cat, indent=2) + "\n")
        print(f"Wrote {path} light={cat['trafficLight']} quarters={len(cat['quarters'])} verified={cat['verified']}")


if __name__ == "__main__":
    main()
