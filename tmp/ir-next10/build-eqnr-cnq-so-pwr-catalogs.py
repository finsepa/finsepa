#!/usr/bin/env python3
"""Build EQNR / CNQ / SO / PWR IR vault discovery catalogs (JSON only)."""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

OUT = Path("/Users/rakshamann/Desktop/Finsepa/tmp/ir-next10")
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)


def curl(url: str, referer: str | None = None, tls12: bool = False) -> bytes:
    cmd = ["curl", "-sL", "--max-time", "90", "-A", UA]
    if tls12:
        cmd.append("--tlsv1.2")
    if referer:
        cmd.extend(["-H", f"Referer: {referer}"])
    cmd.append(url)
    return subprocess.check_output(cmd)


def pdf_ok(url: str) -> bool:
    try:
        out = subprocess.check_output(
            ["curl", "-s", "-A", UA, "-H", "Range: bytes=0-4", url],
            stderr=subprocess.DEVNULL,
        )
        return out.startswith(b"%PDF")
    except Exception:
        return False


def verify_quarters(quarters: dict[str, dict]) -> dict:
    ok = bad = 0
    g = y = r = 0
    for slot in quarters.values():
        s, f = slot.get("slides"), slot.get("filings")
        has_s, has_f = bool(s), bool(f)
        if has_s and has_f and s != f:
            g += 1
        elif has_s or has_f:
            y += 1
        else:
            r += 1
        for u in (s, f):
            if not u:
                continue
            if pdf_ok(u):
                ok += 1
            else:
                bad += 1
                print(f"  BAD PDF: {u}")
    return {
        "method": "Range-GET bytes=0-4",
        "ok": ok,
        "bad": bad,
        "quarterCounts": {"green": g, "yellow": y, "red": r},
    }


def traffic_light(verified: dict) -> str:
    qc = verified["quarterCounts"]
    if qc["green"] > 0 and qc["yellow"] == 0 and qc["red"] == 0:
        return "green"
    if qc["green"] == 0 and qc["yellow"] == 0:
        return "red"
    return "yellow"


def sort_qk(q: dict) -> dict:
    def key(s: str):
        qn, yr = s.split()
        return int(yr), int(qn[1])

    return {k: q[k] for k in sorted(q.keys(), key=key)}


def build_so() -> dict:
    base = "https://investor.southerncompany.com"
    referer = f"{base}/financial-information/quarterly-earnings"
    raw = curl(
        f"{base}/feed/FinancialReport.svc/GetFinancialReportList",
        referer=referer,
    )
    items = json.loads(raw).get("GetFinancialReportListResult") or []
    cdn = "https://s27.q4cdn.com/273397814"
    qmap = {
        "First Quarter": "Q1",
        "Second Quarter": "Q2",
        "Third Quarter": "Q3",
        "Fourth Quarter": "Q4",
    }

    def norm_url(p: str | None) -> str | None:
        if not p:
            return None
        p = p.strip()
        if p.startswith("http"):
            return p
        if "273397814" in p:
            idx = p.find("273397814")
            tail = p[idx + len("273397814") :].lstrip("/")
            return f"{cdn}/{tail}"
        if p.startswith("/"):
            return cdn + p
        return None

    quarters: dict[str, dict] = {}
    for it in items:
        sub = it.get("ReportSubType") or ""
        yr = it.get("ReportYear")
        if sub not in qmap or not yr or yr < 2022:
            continue
        qk = f"{qmap[sub]} {yr}"
        slides = filings = None
        for d in it.get("Documents") or []:
            cat = (d.get("DocumentCategory") or "").lower()
            url = norm_url(d.get("DocumentPath"))
            if not url or not url.lower().endswith(".pdf"):
                continue
            if cat == "presentation":
                slides = url
            elif cat == "news":
                filings = url
            elif cat == "package" and filings is None:
                filings = url
        if slides or filings:
            quarters[qk] = {"slides": slides, "filings": filings}

    verified = verify_quarters(quarters)
    g, y, r = verified["quarterCounts"].values()
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
            "Southern Company calendar utility FY. q4 FinancialReport.svc: "
            "Slides=DocumentCategory presentation (earnings call deck); "
            "Filings=DocumentCategory news (earnings press release PDF). "
            f"Scope Q1 2022→latest ({g} green / {y} yellow / {r} red). "
            "Reject 10-Q/10-K/package-only. Never SEC HTML. Range-GET %PDF verified."
        ),
        "quarters": sort_qk(quarters),
        "verified": verified,
    }


def q_from_pwr_fname(fname: str) -> str | None:
    for pat, qn in [
        (r"FIRST_QUARTER_(\d{4})", "Q1"),
        (r"SECOND_QUARTER_(\d{4})", "Q2"),
        (r"THIRD_QUARTER_(\d{4})", "Q3"),
        (r"FOURTH_QUARTER(?:_AND_FULL)?[_ ](\d{4})", "Q4"),
    ]:
        m = re.search(pat, fname, re.I)
        if m:
            return f"{qn} {m.group(1)}"
    m = re.search(r"(\d{2})-(\d{2})-(\d{4})", fname)
    if m:
        mo, yr = int(m.group(1)), int(m.group(3))
        return f"Q{(mo - 1) // 3 + 1} {yr}"
    m = re.search(r"(\d{2})\.(\d{2})\.(\d{4})", fname)
    if m:
        mo, yr = int(m.group(1)), int(m.group(3))
        return f"Q{(mo - 1) // 3 + 1} {yr}"
    return None


def q_from_pwr_q4_news(fname: str) -> str | None:
    """Feb Q4/full-year press PDFs map to prior calendar Q4."""
    m = re.search(r"^(\d{4})-(\d{2})-(\d{2})_.*FOURTH_QUARTER", fname, re.I)
    if not m:
        return None
    y = int(m.group(1))
    return f"Q4 {y - 1}"


def build_pwr() -> dict:
    url = "https://investors.quantaservices.com/financial-information/financial-results"
    html = curl(url).decode("utf-8", "replace")
    pdfs = sorted(set(re.findall(r"(https://investors\.quantaservices\.com/_assets/[^\"']+\.pdf)", html)))
    quarters: dict[str, dict] = {}
    for p in pdfs:
        fname = p.split("/")[-1]
        path = p.lower()
        qk = q_from_pwr_fname(fname)
        if not qk and "/news/" in path:
            qk = q_from_pwr_q4_news(fname)
        if not qk or int(qk.split()[1]) < 2022:
            continue
        quarters.setdefault(qk, {"slides": None, "filings": None})
        if "/presentation/" in path and "earnings_deck" in fname.lower():
            quarters[qk]["slides"] = p
        elif "/operational_and_financial_commentary/" in path:
            quarters[qk]["slides"] = p
        elif "/news/" in path and "quanta_services_reports" in fname.lower():
            quarters[qk]["filings"] = p

    verified = verify_quarters(quarters)
    g, y, r = verified["quarterCounts"].values()
    return {
        "ticker": "PWR",
        "fyEnd": "12-31",
        "irPages": [
            "https://investors.quantaservices.com/",
            url,
            "https://investors.quantaservices.com/news-events/press-releases",
        ],
        "pdfHost": "investors.quantaservices.com/_assets/.../quantaservices/",
        "trafficLight": traffic_light(verified),
        "notes": (
            "Quanta Services calendar FY. Financial Results page (not /quarterly-results). "
            "Slides=Earnings Deck (2022–2023) or Operational and Financial Commentary (2024+); "
            "Filings=news/ QUANTA_SERVICES_REPORTS_* earnings release PDF "
            "(Q4 uses Feb FOURTH_QUARTER_AND_FULL → prior-year Q4). "
            "Reject Outlook Expectations / 10-Q / webcast. "
            f"Scope Q1 2022→Q2 2026 ({g} green / {y} yellow / {r} red). Range-GET %PDF verified."
        ),
        "quarters": sort_qk(quarters),
        "verified": verified,
    }


def eqnr_quarter_key(label: str, fn: str) -> str | None:
    blob = f"{label} {fn}".lower()
    m = re.search(r"\b([1-4])q[- ](20\d{2})\b", blob)
    if m:
        return f"Q{m.group(1)} {m.group(2)}"
    for pat in [
        r"\bq([1-4])[- ](20\d{2})\b",
        r"\bq([1-4])\s*(20\d{2})\b",
        r"\b(20\d{2})\s*q([1-4])\b",
    ]:
        m = re.search(pat, blob)
        if m:
            if pat.startswith(r"\b(20"):
                return f"Q{m.group(2)} {m.group(1)}"
            return f"Q{m.group(1)} {m.group(2)}"
    m = re.search(r"q4-and-full-year-(20\d{2})", blob)
    if m:
        return f"Q4 {m.group(1)}"
    m = re.search(r"financial-statements-and-review-q4-(20\d{2})", blob)
    if m:
        return f"Q4 {m.group(1)}"
    m = re.search(r"\bq4-(20\d{2})-cmu", blob)
    if m:
        return f"Q4 {m.group(1)}"
    m = re.search(r"full-year-(20\d{2})", blob)
    if m:
        return f"Q4 {int(m.group(1)) - 1}"
    return None


def build_eqnr() -> dict:
    page = "https://www.equinor.com/investors/quarterly-results"
    html = curl(page).decode("utf-8", "replace")
    pat = (
        r'originalFilename\\":\\"([^\\"]+\.pdf)\\"[^}]{0,800}?'
        r'\\"url\\":\\"(https://cdn\.sanity\.io/files/h61q9gi9/global/[a-f0-9]+\.pdf)\\"'
    )
    items = re.findall(pat, html)
    quarters: dict[str, dict] = {}
    for fn, url in items:
        blob = fn.lower()
        if "transcript" in blob:
            continue
        qk = eqnr_quarter_key("", fn)
        if not qk or int(qk.split()[1]) < 2022:
            continue
        quarters.setdefault(qk, {"slides": None, "filings": None})
        if re.search(
            r"cfo-presentation|ceo.*presentation|cmu.*cfo|cmu.*presentation|presentation",
            blob,
        ):
            if "financial-statements" not in blob and "transcript" not in blob:
                quarters[qk]["slides"] = url
        elif re.search(
            r"financial-statements-and[\s-]*review|interim-report|press-release|results-report",
            blob,
        ):
            quarters[qk]["filings"] = url

    verified = verify_quarters(quarters)
    g, y, r = verified["quarterCounts"].values()
    return {
        "ticker": "EQNR",
        "fyEnd": "12-31",
        "irPages": [
            "https://www.equinor.com/investors",
            page,
            "https://www.equinor.com/investors/annual-reports",
        ],
        "pdfHost": "cdn.sanity.io/files/h61q9gi9/global",
        "trafficLight": traffic_light(verified),
        "notes": (
            "Equinor ASA ADR; calendar FY. quarterly-results hub on equinor.com/investors. "
            "Slides=CFO/CEO quarterly presentation PDFs on Sanity CDN; "
            "Filings=financial-statements-and-review (interim report) PDF. "
            "Reject transcripts / duplicate statement PDFs. "
            f"Scope Q1 2022→latest ({g} green / {y} yellow / {r} red). Range-GET %PDF verified."
        ),
        "quarters": sort_qk(quarters),
        "verified": verified,
    }


def cnq_quarter_from_title(title: str) -> str | None:
    t = title.lower()
    m = re.search(
        r"(first|second|third|fourth)\s+quarter\s+(?:and\s+year\s+end\s+)?(?:results\s+)?(?:for\s+)?(20\d{2})",
        t,
    )
    if m:
        qmap = {"first": "1", "second": "2", "third": "3", "fourth": "4"}
        return f"Q{qmap[m.group(1)]} {m.group(2)}"
    m = re.search(r"(20\d{2})\s+(first|second|third|fourth)\s+quarter", t)
    if m:
        qmap = {"first": "1", "second": "2", "third": "3", "fourth": "4"}
        return f"Q{qmap[m.group(2)]} {m.group(1)}"
    return None


def cnq_fetch_quarter_posts() -> list[tuple[str, str]]:
    """WP search API: quarterly results news posts (canonical /news-releases/ URLs)."""
    out: list[tuple[str, str]] = []
    for page in range(1, 8):
        url = (
            "https://www.cnrl.com/wp-json/wp/v2/search"
            f"?search=Quarter+Results&per_page=100&page={page}"
        )
        raw = curl(url, tls12=True)
        try:
            rows = json.loads(raw)
        except json.JSONDecodeError:
            break
        if not rows:
            break
        for row in rows:
            title = row.get("title") or ""
            link = row.get("url") or ""
            if link and title:
                out.append((title, link))
    return out


def cnq_pdfs_from_post(html: str) -> list[str]:
    pdfs: list[str] = []
    for m in re.finditer(r'href=(["\']?)([^"\s>]+\.pdf)\1?', html, re.I):
        p = m.group(2)
        if p.startswith("/"):
            p = "https://www.cnrl.com" + p
        elif not p.startswith("http"):
            p = "https://www.cnrl.com/" + p.lstrip("/")
        pdfs.append(p)
    return pdfs


def build_cnq() -> dict:
    quarters: dict[str, dict] = {}
    posts = cnq_fetch_quarter_posts()
    for title, link in posts:
        qk = cnq_quarter_from_title(title)
        if not qk or int(qk.split()[1]) < 2022:
            continue
        html = curl(link, tls12=True).decode("utf-8", "replace")
        pdfs = cnq_pdfs_from_post(html)
        if not pdfs:
            continue
        slot = quarters.setdefault(qk, {"slides": None, "filings": None})
        for url in pdfs:
            fn = url.split("/")[-1].lower()
            if any(x in fn for x in ("sustainability", "dividend", "budget", "voting")):
                continue
            if any(
                x in fn
                for x in (
                    "presentation",
                    "investor",
                    "corp-pres",
                    "webcast",
                    "slides",
                    "_p_",
                    "-p-",
                )
            ):
                if quarters[qk]["slides"] is None:
                    quarters[qk]["slides"] = url
            elif any(
                x in fn
                for x in (
                    "release",
                    "results",
                    "financial",
                    "front-end",
                    "earnings",
                    "q1",
                    "q2",
                    "q3",
                    "q4",
                    "1q",
                    "2q",
                    "3q",
                    "4q",
                )
            ):
                if quarters[qk]["filings"] is None:
                    quarters[qk]["filings"] = url

    # Drop quarters where crawl found no lockable PDFs.
    quarters = {
        k: v
        for k, v in quarters.items()
        if v.get("slides") or v.get("filings")
    }

    verified = verify_quarters(quarters)
    g, y, r = verified["quarterCounts"].values()
    return {
        "ticker": "CNQ",
        "fyEnd": "12-31",
        "irPages": [
            "https://www.cnrl.com/investors/",
            "https://www.cnrl.com/investors/news-releases/",
            "https://www.cnrl.com/news-releases/",
        ],
        "pdfHost": "www.cnrl.com/wp-content/uploads",
        "trafficLight": traffic_light(verified),
        "notes": (
            "Canadian Natural Resources calendar FY. WP REST (`news_release` CPT) lists quarterly "
            "results at cnrl.com/news-releases/, but article HTML is press-only (no .pdf hrefs on "
            "spot-checked Q2 2024 / Q2 2026). Events page has ad-hoc corp presentations, not a "
            "consistent Q1 2022→ deck/release matrix. Filings=null until CNRL links PDF press packs. "
            f"Catalog empty ({g}/{y}/{r}). Never SEC HTML / SEDAR PDFs."
        ),
        "quarters": sort_qk(quarters),
        "verified": verified,
    }


def main() -> None:
    builders = [
        ("eqnr", build_eqnr),
        ("cnq", build_cnq),
        ("so", build_so),
        ("pwr", build_pwr),
    ]
    for name, fn in builders:
        print(f"\n=== {name.upper()} ===")
        cat = fn()
        path = OUT / f"{name}-catalog.json"
        path.write_text(json.dumps(cat, indent=2) + "\n")
        print(
            f"Wrote {path.name} light={cat['trafficLight']} "
            f"quarters={len(cat['quarters'])} verified={cat['verified']}"
        )


if __name__ == "__main__":
    main()
