#!/usr/bin/env python3
"""Discover PNC / MGCLY / PSTVY / GD IR earnings PDF catalogs (Q1 2022 → latest)."""
from __future__ import annotations

import json
import re
import ssl
import urllib.parse
import urllib.request
from collections import OrderedDict
from html.parser import HTMLParser
from pathlib import Path

OUT = Path("/Users/rakshamann/Desktop/Finsepa/tmp/ir-next10")
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)
CTX = ssl.create_default_context()

QUARTERS = []
for y in range(2022, 2027):
    for q in range(1, 5):
        QUARTERS.append(f"Q{q} {y}")
# drop future unreported past Q2 2026 (latest known reported across these names)
LATEST = "Q2 2026"
while QUARTERS and QUARTERS[-1] != LATEST:
    # keep through LATEST inclusive; trim if we went past
    if QUARTERS[-1] > LATEST and (
        int(QUARTERS[-1].split()[1]) > 2026
        or (int(QUARTERS[-1].split()[1]) == 2026 and int(QUARTERS[-1][1]) > 2)
    ):
        QUARTERS.pop()
    else:
        break
# Explicit scope Q1 2022 → Q2 2026
QUARTERS = [f"Q{q} {y}" for y in range(2022, 2027) for q in range(1, 5)]
QUARTERS = [q for q in QUARTERS if not (int(q.split()[1]) == 2026 and int(q[1]) > 2)]


def fetch(url: str, timeout: int = 45) -> tuple[int, str, bytes]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    try:
        with urllib.request.urlopen(req, context=CTX, timeout=timeout) as r:
            return r.status, r.geturl(), r.read()
    except Exception as e:
        print(f"FETCH FAIL {url}: {e}")
        return 0, url, b""


def head_pdf(url: str) -> bool:
    req = urllib.request.Request(
        url, method="GET", headers={"User-Agent": UA, "Range": "bytes=0-7"}
    )
    try:
        with urllib.request.urlopen(req, context=CTX, timeout=30) as r:
            return r.read(5).startswith(b"%PDF")
    except Exception as e:
        print(f"  PDF check fail {url}: {e}")
        return False


def empty_quarters() -> OrderedDict:
    return OrderedDict((q, {"slides": None, "filings": None}) for q in QUARTERS)


def score_quarters(quarters: dict) -> tuple[str, dict]:
    g = y = r = 0
    for q, v in quarters.items():
        s, f = v.get("slides"), v.get("filings")
        if s and f and s != f:
            g += 1
        elif s or f:
            y += 1
        else:
            r += 1
    if r == 0 and y == 0:
        light = "green"
    elif g == 0 and y == 0:
        light = "red"
    else:
        light = "yellow"
    return light, {"green": g, "yellow": y, "red": r}


def abs_url(base: str, href: str) -> str:
    return urllib.parse.urljoin(base, href.replace("&amp;", "&"))


# ---------- PNC ----------
def discover_pnc() -> dict:
    page = "https://investor.pnc.com/financial-information/financial-results"
    code, final, data = fetch(page)
    html = data.decode("utf-8", "ignore")
    (OUT / "pnc-financial-results.html").write_bytes(data[:500000])

    # Map quarter headers to presentation + earnings_release cloudfront PDFs
    quarters = empty_quarters()
    # Split by Qx YYYY headings
    parts = re.split(r"(?i)(?:###\s*)?(Q[1-4]\s+20\d{2})", html)
    # parts: [pre, Q1 2026, block, Q2 2026, block, ...]
    for i in range(1, len(parts), 2):
        label = parts[i].strip()
        block = parts[i + 1] if i + 1 < len(parts) else ""
        if label not in quarters:
            # try normalize
            m = re.match(r"(Q[1-4])\s+(20\d{2})", label)
            if not m:
                continue
            label = f"{m.group(1)} {m.group(2)}"
            if label not in quarters:
                continue
        pdfs = re.findall(
            r"https://d1io3yog0oux5\.cloudfront\.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/[^\"'\s<>]+\.pdf",
            block,
            re.I,
        )
        slides = filings = None
        for u in pdfs:
            u = urllib.parse.unquote(u)
            low = u.lower()
            if "/presentation/" in low or "earnings+slides" in low or "earnings_slides" in low or "_er_presentation" in low:
                slides = slides or u
            elif "/earnings_release/" in low or "earnings+release" in low or "_er_press" in low or "news/" in low and "net_income" in low:
                filings = filings or u
        # Q4 2022 filings was under /news/ not /earnings_release/
        if label in quarters:
            if slides:
                quarters[label]["slides"] = slides
            if filings:
                quarters[label]["filings"] = filings

    # Fallback: also parse globally by filename quarter tags if any missing
    all_pdfs = re.findall(
        r"https://d1io3yog0oux5\.cloudfront\.net/_4e5e08af015bf43a80b7ef8f568e009a/pnc/[^\"'\s<>]+\.pdf",
        html,
        re.I,
    )
    def q_from_name(u: str) -> str | None:
        uq = urllib.parse.unquote(u)
        m = re.search(r"([1-4])Q(2[2-6])", uq, re.I)
        if m:
            return f"Q{m.group(1)} 20{m.group(2)}"
        m = re.search(r"Q([1-4])\+?20(2[2-6])", uq, re.I)
        if m:
            return f"Q{m.group(1)} 20{m.group(2)}"
        m = re.search(r"PNC_([1-4])Q(2[2-6])", uq, re.I)
        if m:
            return f"Q{m.group(1)} 20{m.group(2)}"
        m = re.search(r"([1-4])Q(2[2-6])_", uq, re.I)
        if m:
            return f"Q{m.group(1)} 20{m.group(2)}"
        # 4Q22 style in path folders less reliable; skip
        return None

    for u in all_pdfs:
        u = urllib.parse.unquote(u)
        label = q_from_name(u)
        if not label or label not in quarters:
            continue
        low = u.lower()
        if "/presentation/" in low or "slides" in low or "_presentation" in low:
            if not quarters[label]["slides"]:
                quarters[label]["slides"] = u
        elif "/earnings_release/" in low or "earnings+release" in low or "earnings_release" in low or (
            "/news/" in low and "report" in low
        ):
            if not quarters[label]["filings"]:
                quarters[label]["filings"] = u

    light, counts = score_quarters(quarters)
    # verify
    ok = bad = 0
    for q, v in quarters.items():
        for slot in ("slides", "filings"):
            url = v[slot]
            if not url:
                continue
            if head_pdf(url):
                ok += 1
            else:
                bad += 1
                print(f"PNC VERIFY FAIL {q} {slot}: {url}")
                v[slot] = None
    light, counts = score_quarters(quarters)
    return {
        "ticker": "PNC",
        "fyEnd": "12-31",
        "irPages": [
            "https://investor.pnc.com/",
            "https://investor.pnc.com/financial-information/financial-results",
        ],
        "pdfHost": "d1io3yog0oux5.cloudfront.net/.../pnc",
        "trafficLight": light,
        "verified": bad == 0,
        "notes": (
            f"PNC calendar FY (Dec). Stockpr/CloudFront: Slides=Earnings Slides/Presentation; "
            f"Filings=Earnings Release on d1io3yog0oux5.cloudfront.net. Never 10-Q/10-K/SEC HTML. "
            f"Scope Q1 2022→Q2 2026 ({counts['green']}g/{counts['yellow']}y/{counts['red']}r). "
            f"Range-GET ok/bad={ok}/{bad}. page_status={code}."
        ),
        "quarters": quarters,
        "_counts": counts,
    }


# ---------- GD ----------
def discover_gd() -> dict:
    api = (
        "https://investorrelations.gd.com/feed/Event.svc/GetEventList"
        "?languageId=1&bodyType=3&pageNumber=1&pageSize=100"
        "&includeTags=true&excludeTags=false&eventSelection=0"
        "&sortOperator=1&eventDateFilter=0"
    )
    code, final, data = fetch(api)
    (OUT / "gd-events.json").write_bytes(data)
    quarters = empty_quarters()
    try:
        payload = json.loads(data.decode("utf-8"))
        events = payload.get("GetEventListResult") or []
    except Exception as e:
        print("GD JSON fail", e)
        events = []

    for ev in events:
        title = ev.get("Title") or ""
        if "Earnings" not in title and "earnings" not in title:
            continue
        # Extract quarter from title: Q2 2026 / Q4 2025 / Fourth Quarter etc.
        label = None
        m = re.search(r"Q([1-4])\s+(20\d{2})", title)
        if m:
            label = f"Q{m.group(1)} {m.group(2)}"
        else:
            m = re.search(
                r"(First|Second|Third|Fourth)\s+Quarter\s+(20\d{2})", title, re.I
            )
            if m:
                qm = {"first": 1, "second": 2, "third": 3, "fourth": 4}[m.group(1).lower()]
                label = f"Q{qm} {m.group(2)}"
        if not label or label not in quarters:
            continue
        slides = filings = None
        for att in ev.get("Attachments") or []:
            t = (att.get("Title") or "").lower()
            url = att.get("Url") or ""
            if not url.lower().endswith(".pdf"):
                continue
            if "presentation" in t or "highlight" in t:
                slides = slides or url
            elif "press" in t or "release" in t or "exhibit" in t:
                filings = filings or url
        if slides:
            quarters[label]["slides"] = slides
        if filings:
            quarters[label]["filings"] = filings

    ok = bad = 0
    for q, v in quarters.items():
        for slot in ("slides", "filings"):
            url = v[slot]
            if not url:
                continue
            if head_pdf(url):
                ok += 1
            else:
                bad += 1
                print(f"GD VERIFY FAIL {q} {slot}: {url}")
                v[slot] = None
    light, counts = score_quarters(quarters)
    return {
        "ticker": "GD",
        "fyEnd": "12-31",
        "irPages": [
            "https://investorrelations.gd.com/",
            "https://investorrelations.gd.com/financial-reports/quarterly-financial-results/default.aspx",
        ],
        "pdfHost": "s22.q4cdn.com/891946778",
        "trafficLight": light,
        "verified": bad == 0,
        "notes": (
            f"GD calendar FY (Dec). Q4 Event feed: Slides=Highlights/Presentation; "
            f"Filings=Press Release / Exhibit 99.1 on s22.q4cdn.com/891946778. Never 10-Q/SEC HTML. "
            f"Scope Q1 2022→Q2 2026 ({counts['green']}g/{counts['yellow']}y/{counts['red']}r). "
            f"Range-GET ok/bad={ok}/{bad}. api_status={code}."
        ),
        "quarters": quarters,
        "_counts": counts,
    }


# ---------- PSTVY (PSBC) ----------
def discover_pstvy() -> dict:
    base = "https://www.psbc.com/en/investor_relations"
    pages = {
        "present": f"{base}/result_Presenta/",
        "announce": f"{base}/announcement/",
        "reports": f"{base}/finance/financial_reports/",
    }
    htmls = {}
    for k, url in pages.items():
        code, final, data = fetch(url)
        htmls[k] = data.decode("utf-8", "ignore")
        (OUT / f"pstvy-{k}.html").write_bytes(data[:500000])
        print(f"PSTVY {k}: {code} {len(data)}")

    # Paginate announcements / financial reports if "next" exists
    for k, url in list(pages.items()):
        if k == "present":
            continue
        for page_i in range(2, 12):
            # typical cn CMS: index_N.html
            cand = url.rstrip("/") + f"/index_{page_i}.html"
            code, final, data = fetch(cand)
            if code != 200 or len(data) < 1000:
                break
            more = data.decode("utf-8", "ignore")
            if "Results" not in more and "Quarterly" not in more and "Interim" not in more and "Annual" not in more:
                # still keep if has pdf links
                if ".pdf" not in more.lower() and "P0" not in more:
                    break
            htmls[k] += "\n" + more
            (OUT / f"pstvy-{k}-{page_i}.html").write_bytes(data[:300000])
            print(f"PSTVY {k} page {page_i}: {code} {len(data)}")

    quarters = empty_quarters()

    # Presentations: Interim → Q2, Annual → Q4
    for m in re.finditer(r"<li([^>]*)>(.*?)</li>", htmls["present"], re.S | re.I):
        attrs, body = m.group(1), m.group(2)
        title_m = re.search(r"title-tj[^>]*>(.*?)<", body, re.S)
        if not title_m:
            continue
        t = re.sub(r"<[^>]+>", "", title_m.group(1)).strip()
        ym = re.search(r"(20\d{2})\s+(Interim|Annual)\s+Results\s+Presentation", t, re.I)
        if not ym:
            continue
        year, kind = ym.group(1), ym.group(2).lower()
        label = f"Q2 {year}" if kind == "interim" else f"Q4 {year}"
        if label not in quarters:
            continue
        data_src = re.search(r"data-src='([^']*)'", attrs)
        data_file = re.search(r"data-file='([^']*)'", attrs)
        pdf = ""
        if data_src and data_src.group(1).endswith(".pdf"):
            pdf = data_src.group(1)
        elif data_file and data_file.group(1).endswith(".pdf"):
            pdf = data_file.group(1)
        else:
            allp = re.findall(r"[./0-9A-Za-z_/]*P0\d+\.pdf", attrs + " " + body)
            pdf = allp[0] if allp else ""
        if pdf:
            quarters[label]["slides"] = abs_url(pages["present"], pdf)

    # Filings from announcements + financial reports
    # Prefer Results Announcement PDFs; else Quarterly/Interim/Annual Report PDFs
    announce_html = htmls["announce"] + "\n" + htmls["reports"]

    # Need to follow announcement HTML pages to get PDF links for results
    result_links: list[tuple[str, str, str]] = []  # label, kind, href
    for m in re.finditer(
        r'href="([^"]+)"[^>]*title="([^"]+)"', announce_html, re.I
    ):
        href, title = m.group(1), m.group(2)
        low = title.lower()
        label = None
        kind = None
        if re.search(r"interim results announcement", low):
            ym = re.search(r"(20\d{2})", title)
            if ym:
                label, kind = f"Q2 {ym.group(1)}", "announce"
        elif re.search(r"annual results announcement", low):
            ym = re.search(r"(20\d{2})", title)
            if ym:
                label, kind = f"Q4 {ym.group(1)}", "announce"
        elif re.search(r"first quarterly report", low):
            ym = re.search(r"(20\d{2})", title)
            if ym:
                label, kind = f"Q1 {ym.group(1)}", "report"
        elif re.search(r"third quarterly report", low):
            ym = re.search(r"(20\d{2})", title)
            if ym:
                label, kind = f"Q3 {ym.group(1)}", "report"
        elif re.search(r"interim report", low) and "dividend" not in low:
            ym = re.search(r"(20\d{2})", title)
            if ym:
                label, kind = f"Q2 {ym.group(1)}", "report"
        elif re.search(r"annual report", low) and "social" not in low:
            ym = re.search(r"(20\d{2})", title)
            if ym:
                label, kind = f"Q4 {ym.group(1)}", "report"
        if label and label in quarters:
            result_links.append((label, kind or "report", abs_url(pages["announce"] if "announcement" in href or href.startswith("./20") else pages["reports"], href)))

    # Also direct PDF links on financial reports page
    for m in re.finditer(
        r'href="([^"]+\.pdf)"[^>]*title="([^"]+)"', htmls["reports"], re.I
    ):
        href, title = m.group(1), m.group(2)
        low = title.lower()
        label = None
        if "first quarterly" in low:
            ym = re.search(r"(20\d{2})", title)
            label = f"Q1 {ym.group(1)}" if ym else None
        elif "third quarterly" in low:
            ym = re.search(r"(20\d{2})", title)
            label = f"Q3 {ym.group(1)}" if ym else None
        elif "interim report" in low:
            ym = re.search(r"(20\d{2})", title)
            label = f"Q2 {ym.group(1)}" if ym else None
        elif "annual report" in low:
            ym = re.search(r"(20\d{2})", title)
            label = f"Q4 {ym.group(1)}" if ym else None
        if label and label in quarters:
            result_links.append((label, "report", abs_url(pages["reports"], href)))

    # Resolve HTML announcement pages → PDF
    # Prefer announce over report for same quarter
    ranked: dict[str, list[tuple[int, str]]] = {}
    for label, kind, href in result_links:
        prio = 0 if kind == "announce" else 1
        ranked.setdefault(label, []).append((prio, href))

    for label, cands in ranked.items():
        cands.sort()
        pdf_url = None
        for _prio, href in cands:
            if href.lower().endswith(".pdf"):
                pdf_url = href
                break
            # fetch HTML page for PDF link
            code, final, data = fetch(href)
            h = data.decode("utf-8", "ignore")
            pdfs = re.findall(r'href="([^"]+\.pdf)"', h, re.I)
            # also P0 patterns
            pdfs += re.findall(r'href="([^"]*P0\d+\.pdf)"', h, re.I)
            for p in pdfs:
                full = abs_url(href, p)
                if "psbc.com" in full:
                    pdf_url = full
                    break
            if pdf_url:
                break
        if pdf_url:
            quarters[label]["filings"] = pdf_url

    # Paginate more financial report years if needed — fetch older index pages
    for page_i in range(2, 15):
        cand = pages["reports"].rstrip("/") + f"/index_{page_i}.html"
        code, final, data = fetch(cand)
        if code != 200 or len(data) < 500:
            break
        h = data.decode("utf-8", "ignore")
        for m in re.finditer(r'href="([^"]+\.pdf)"[^>]*title="([^"]+)"', h, re.I):
            href, title = m.group(1), m.group(2)
            low = title.lower()
            label = None
            if "first quarterly" in low:
                ym = re.search(r"(20\d{2})", title)
                label = f"Q1 {ym.group(1)}" if ym else None
            elif "third quarterly" in low:
                ym = re.search(r"(20\d{2})", title)
                label = f"Q3 {ym.group(1)}" if ym else None
            elif "interim report" in low:
                ym = re.search(r"(20\d{2})", title)
                label = f"Q2 {ym.group(1)}" if ym else None
            elif "annual report" in low:
                ym = re.search(r"(20\d{2})", title)
                label = f"Q4 {ym.group(1)}" if ym else None
            if label and label in quarters and not quarters[label]["filings"]:
                quarters[label]["filings"] = abs_url(cand, href)

    # Also paginate announcements for results announcements 2022+
    for page_i in range(2, 40):
        cand = pages["announce"].rstrip("/") + f"/index_{page_i}.html"
        code, final, data = fetch(cand)
        if code != 200 or len(data) < 500:
            break
        h = data.decode("utf-8", "ignore")
        found_any = False
        for m in re.finditer(r'href="([^"]+)"[^>]*title="([^"]+)"', h, re.I):
            href, title = m.group(1), m.group(2)
            low = title.lower()
            label = None
            if "interim results announcement" in low:
                ym = re.search(r"(20\d{2})", title)
                label = f"Q2 {ym.group(1)}" if ym else None
            elif "annual results announcement" in low:
                ym = re.search(r"(20\d{2})", title)
                label = f"Q4 {ym.group(1)}" if ym else None
            if not label or label not in quarters:
                continue
            found_any = True
            # Prefer announcement over existing report filing
            detail = abs_url(cand, href)
            if detail.lower().endswith(".pdf"):
                quarters[label]["filings"] = detail
                continue
            code2, _, data2 = fetch(detail)
            h2 = data2.decode("utf-8", "ignore")
            pdfs = re.findall(r'href="([^"]+\.pdf)"', h2, re.I)
            for p in pdfs:
                full = abs_url(detail, p)
                if "psbc.com" in full:
                    quarters[label]["filings"] = full
                    break
        if not found_any and page_i > 5:
            # stop if deep without results titles — but keep going a bit for history
            pass

    ok = bad = 0
    for q, v in quarters.items():
        for slot in ("slides", "filings"):
            url = v[slot]
            if not url:
                continue
            if head_pdf(url):
                ok += 1
            else:
                bad += 1
                print(f"PSTVY VERIFY FAIL {q} {slot}: {url}")
                v[slot] = None
    light, counts = score_quarters(quarters)
    return {
        "ticker": "PSTVY",
        "fyEnd": "12-31",
        "irPages": [
            "https://www.psbc.com/en/investor_relations/",
            "https://www.psbc.com/en/investor_relations/result_Presenta/",
            "https://www.psbc.com/en/investor_relations/announcement/",
            "https://www.psbc.com/en/investor_relations/finance/financial_reports/",
        ],
        "pdfHost": "www.psbc.com/en/investor_relations",
        "trafficLight": light,
        "verified": bad == 0,
        "notes": (
            f"PSTVY=PSBC ADR. Calendar FY. Slides=Results Presentations (Interim→Q2, Annual→Q4); "
            f"Filings=Results Announcement or Quarterly/Interim/Annual Report PDF on psbc.com. "
            f"Q1/Q3 typically filings-only (no presentation). Never HKEX-only / SEC. "
            f"Scope Q1 2022→Q2 2026 ({counts['green']}g/{counts['yellow']}y/{counts['red']}r). "
            f"Range-GET ok/bad={ok}/{bad}."
        ),
        "quarters": quarters,
        "_counts": counts,
    }


# ---------- MGCLY (Midea) ----------
def discover_mgcly() -> dict:
    page = "https://www.midea.com.cn/en/Investors/Financial_Reports"
    code, final, data = fetch(page)
    html = data.decode("utf-8", "ignore")
    (OUT / "mgcly-financial-reports.html").write_bytes(data[:500000])
    print(f"MGCLY FR: {code} {len(data)}")

    # Also Chinese page + investors home for press/snapshots
    pages_extra = [
        "https://www.midea.com.cn/zh/Investors/Financial_Reports",
        "https://www.midea.com.cn/en/Investors",
        "https://www.midea.com.cn/en/Investors/information_disclosure",
    ]
    extra_html = html
    for url in pages_extra:
        c, f, d = fetch(url)
        print(f"MGCLY extra {url}: {c} {len(d)}")
        if d:
            (OUT / f"mgcly-{abs(hash(url)) % 10**8}.html").write_bytes(d[:400000])
            extra_html += "\n" + d.decode("utf-8", "ignore")

    quarters = empty_quarters()
    base = "https://www.midea.com.cn"

    # Parse labeled rows: look for year/quarter text near pdf hrefs
    # Pattern: title text then href to content/dam ... pdf
    # From FR page, items look like:
    # 2025 Q1 Press Release Interim Report → quarterly report PDF
    # 2022 Q1 Results in a Snapshot → snapshot PDF (slides)

    # Extract all dam pdf links with surrounding text
    items = []
    for m in re.finditer(
        r"(?:>([^<]{3,120})</[^>]+>\s*)?<a[^>]+href=\"(/content/dam/[^\"]+\.pdf[^\"]*)\"[^>]*>",
        extra_html,
        re.I,
    ):
        label_txt = (m.group(1) or "").strip()
        href = m.group(2)
        items.append((label_txt, abs_url(base, href.split(".coredownload")[0] if False else href)))

    # Better: for each pdf href, look back 200 chars for label
    for m in re.finditer(r'href="(/content/dam/[^"]+\.pdf[^"]*)"', extra_html, re.I):
        href = m.group(1)
        start = max(0, m.start() - 400)
        ctx = extra_html[start : m.start()]
        # last text chunk
        texts = re.findall(r">([^<]{5,160})<", ctx)
        label_txt = texts[-1].strip() if texts else ""
        full = abs_url(base, href)
        # Prefer .coredownload.inline.pdf paths as-is (they serve PDF)
        items.append((label_txt, full))

    def map_item(label_txt: str, url: str) -> tuple[str | None, str | None]:
        """Return (quarter, slot) slot in slides|filings."""
        t = label_txt
        # Skip ESG / CSR / full annual book unless it's annual results snapshot
        low = t.lower()
        if "esg" in low or "social responsibility" in low or "environmental" in low:
            return None, None
        # Annual report long form — use as Q4 filings only if no better; snapshot preferred as slides
        year = None
        q = None
        ym = re.search(r"(20\d{2})", t)
        if ym:
            year = ym.group(1)
        if re.search(r"\bQ1\b|first quarter|一季度", t, re.I):
            q = 1
        elif re.search(r"\bQ3\b|third quarter|三季度", t, re.I):
            q = 3
        elif re.search(r"\bH1\b|semi[- ]?annual|interim|半年度|中期", t, re.I):
            q = 2
        elif re.search(r"\bQ2\b|second quarter", t, re.I):
            q = 2
        elif re.search(r"annual results|annual report|年度|全年|FY", t, re.I):
            q = 4
        if not year or not q:
            # try filename
            fu = urllib.parse.unquote(url)
            ym = re.search(r"(20\d{2})", fu)
            year = year or (ym.group(1) if ym else None)
            if re.search(r"Q1|一季度|First-Quarter|Q1-", fu, re.I):
                q = q or 1
            elif re.search(r"Q3|三季度|Third-Quarter|Q3-", fu, re.I):
                q = q or 3
            elif re.search(r"Semi|H1|Interim|半年度|Q2", fu, re.I):
                q = q or 2
            elif re.search(r"Annual|年度", fu, re.I):
                q = q or 4
        if not year or not q:
            return None, None
        label = f"Q{q} {year}"
        if label not in quarters:
            return None, None
        # Snapshot / Results in a Snapshot → slides; Press/Financial Report/Interim Report → filings
        if "snapshot" in low or "results in a snapshot" in low:
            return label, "slides"
        if "press" in low or "financial report" in low or "interim report" in low or "quarterly report" in low or "annual report" in low or "semi-annual" in low:
            return label, "filings"
        # filename heuristics
        fu = urllib.parse.unquote(url).lower()
        if "snapshot" in fu:
            return label, "slides"
        if "financial-report" in fu or "financial_report" in fu or "报告" in urllib.parse.unquote(url) or "report" in fu:
            return label, "filings"
        return label, "filings"

    for label_txt, url in items:
        label, slot = map_item(label_txt, url)
        if not label or not slot:
            continue
        # Prefer English paths; skip duplicate overwrite of better English with Chinese only if already set
        if quarters[label][slot]:
            # prefer URL without chinese chars if current has them
            cur = quarters[label][slot]
            if any(ord(c) > 127 for c in cur) and all(ord(c) < 128 for c in url):
                quarters[label][slot] = url
            continue
        quarters[label][slot] = url

    # For 2022 snapshots that are slides-only, and 2023+ financial reports as filings.
    # If a quarter has only one PDF that is a financial report, keep as filings (yellow).
    # If both snapshot and report exist, green.

    # Also try known English PDF URL patterns for 2025/2026 that may be missing from EN page
    # Probe 2026 pages via common dam paths — skipped (unknown). Check HKEX not used.

    ok = bad = 0
    for q, v in quarters.items():
        for slot in ("slides", "filings"):
            url = v[slot]
            if not url:
                continue
            # Try with and without .coredownload.inline.pdf
            candidates = [url]
            if ".coredownload.inline.pdf" in url:
                candidates.append(url.replace(".coredownload.inline.pdf", ""))
            elif url.lower().endswith(".pdf"):
                candidates.append(url + ".coredownload.inline.pdf")
            verified_url = None
            for c in candidates:
                if head_pdf(c):
                    verified_url = c
                    break
            if verified_url:
                ok += 1
                v[slot] = verified_url
            else:
                bad += 1
                print(f"MGCLY VERIFY FAIL {q} {slot}: {url}")
                v[slot] = None

    # Ensure slides != filings
    for q, v in quarters.items():
        if v["slides"] and v["filings"] and v["slides"] == v["filings"]:
            # keep as filings only
            v["slides"] = None

    light, counts = score_quarters(quarters)
    return {
        "ticker": "MGCLY",
        "fyEnd": "12-31",
        "irPages": [
            "https://www.midea.com.cn/en/Investors",
            "https://www.midea.com.cn/en/Investors/Financial_Reports",
        ],
        "pdfHost": "www.midea.com.cn/content/dam",
        "trafficLight": light,
        "verified": bad == 0,
        "notes": (
            f"MGCLY=Midea Group ADR. Calendar FY. English IR Financial Reports: "
            f"Slides=Results Snapshot when published; Filings=Press/Financial/Interim/Quarterly Report PDF "
            f"on midea.com.cn/content/dam. No separate earnings decks for many quarters → yellow. "
            f"Never HKEX-only lock / SEC. Scope Q1 2022→Q2 2026 "
            f"({counts['green']}g/{counts['yellow']}y/{counts['red']}r). Range-GET ok/bad={ok}/{bad}."
        ),
        "quarters": quarters,
        "_counts": counts,
    }


def write_catalog(cat: dict) -> dict:
    counts = cat.pop("_counts", None)
    path = OUT / f"{cat['ticker'].lower()}-catalog.json"
    # JSON with quarters as object preserving order
    out = {
        "ticker": cat["ticker"],
        "fyEnd": cat["fyEnd"],
        "irPages": cat["irPages"],
        "pdfHost": cat["pdfHost"],
        "trafficLight": cat["trafficLight"],
        "notes": cat["notes"],
        "quarters": cat["quarters"],
        "verified": cat["verified"],
    }
    path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {path} light={cat['trafficLight']} counts={counts}")
    return {"ticker": cat["ticker"], "light": cat["trafficLight"], "counts": counts, "host": cat["pdfHost"], "latest": _latest_nonempty(cat["quarters"])}


def _latest_nonempty(quarters: dict) -> str:
    latest = None
    for q, v in quarters.items():
        if v.get("slides") or v.get("filings"):
            latest = q
    return latest or "none"


def main():
    log_lines = ["IR discovery: PNC, MGCLY, PSTVY, GD", "=" * 60]
    summaries = []
    for fn in (discover_pnc, discover_gd, discover_pstvy, discover_mgcly):
        print(f"\n>>> {fn.__name__}")
        cat = fn()
        summaries.append(write_catalog(cat))

    for s in summaries:
        c = s["counts"] or {}
        log_lines.append(
            f"{s['ticker']}: {s['light']} — g/y/r={c.get('green',0)}/{c.get('yellow',0)}/{c.get('red',0)} "
            f"host={s['host']} latest={s['latest']}"
        )
    log_path = OUT / "discover-pnc-mgcly-pstvy-gd.log"
    log_path.write_text("\n".join(log_lines) + "\n")
    print("\n".join(log_lines))
    print(f"Wrote {log_path}")


if __name__ == "__main__":
    main()
