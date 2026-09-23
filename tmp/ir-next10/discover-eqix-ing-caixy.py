#!/usr/bin/env python3
"""Discover EQIX / CAIXY / ING IR earnings PDF catalogs."""
from __future__ import annotations

import json
import re
import ssl
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

OUT = Path("/Users/rakshamann/Desktop/Finsepa/tmp/ir-next10")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
CTX = ssl.create_default_context()


def fetch(url: str, timeout: int = 45) -> tuple[int, str, bytes]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,*/*"})
    try:
        with urllib.request.urlopen(req, context=CTX, timeout=timeout) as r:
            data = r.read()
            return r.status, r.geturl(), data
    except Exception as e:
        print(f"FETCH FAIL {url}: {e}")
        return 0, url, b""


def head_pdf(url: str) -> bool:
    req = urllib.request.Request(url, method="GET", headers={"User-Agent": UA, "Range": "bytes=0-7"})
    try:
        with urllib.request.urlopen(req, context=CTX, timeout=30) as r:
            return r.read(5).startswith(b"%PDF")
    except Exception as e:
        print(f"  PDF check fail {url}: {e}")
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
    # also regex fallback
    p.hrefs.extend(re.findall(r'href=["\']([^"\']+)["\']', html, re.I))
    return p.hrefs


# ---------- EQIX ----------
def discover_eqix() -> dict:
    base = "https://investor.equinix.com"
    cdn = "https://d1io3yog0oux5.cloudfront.net"
    pages = [
        f"{base}/",
        f"{base}/financials/quarterly-results",
        f"{base}/financials/quarterly-results/default.aspx",
        f"{base}/news-events/events-presentations",
        f"{base}/news-events/press-releases",
        f"{base}/financials",
    ]
    # stockpr often has year archive under quarterly-results
    for y in range(2022, 2027):
        pages.append(f"{base}/financials/quarterly-results/{y}")
        pages.append(f"{base}/news-events/press-releases/{y}")

    all_pdfs: set[str] = set()
    page_notes = []
    for url in pages:
        code, final, data = fetch(url)
        html = data.decode("utf-8", "ignore")
        (OUT / f"eqix-page-{abs(hash(url)) % 10**8}.html").write_bytes(data[:500000])
        page_notes.append(f"{code} {final} bytes={len(data)}")
        # absolute + relative cloudfront / site pdfs
        for m in re.findall(r'https?://d1io3yog0oux5\.cloudfront\.net/[^"\'\s<>]+\.pdf', html, re.I):
            all_pdfs.add(urllib.parse.unquote(m.replace("&amp;", "&")))
        for m in re.findall(r'/_f9ad8b88d669de65a966b7e00da37b99/equinix/[^"\'\s<>]+\.pdf', html, re.I):
            all_pdfs.add(urllib.parse.unquote(cdn + m.replace("&amp;", "&")))
        for m in re.findall(r'/equinix/db/[^"\'\s<>]+\.pdf', html, re.I):
            all_pdfs.add(urllib.parse.unquote(cdn + "/_f9ad8b88d669de65a966b7e00da37b99" + m.replace("&amp;", "&")))
        # also look for detail pages linking to earnings
        for href in all_hrefs(html):
            if "quarterly" in href.lower() or "earning" in href.lower() or "press-release" in href.lower():
                if href.startswith("/"):
                    href = base + href
                if href.startswith("http") and "equinix" in href and href not in pages and "sec.gov" not in href:
                    if any(x in href for x in ["detail", "2022", "2023", "2024", "2025", "2026", "quarter"]):
                        pages.append(href) if len(pages) < 80 else None

    # Also try known stockpr RSS / news feeds
    for feed in [
        f"{base}/news-events/press-releases/rss",
        f"{base}/feed/press-release.rss",
    ]:
        code, final, data = fetch(feed)
        page_notes.append(f"feed {code} {final} bytes={len(data)}")
        text = data.decode("utf-8", "ignore")
        for m in re.findall(r'https?://[^"\'\s<>]+\.pdf', text, re.I):
            if "equinix" in m.lower() or "cloudfront" in m.lower():
                all_pdfs.add(urllib.parse.unquote(m.replace("&amp;", "&")))
        for link in re.findall(r'<link>([^<]+)</link>', text):
            if "press-release" in link or "earning" in link.lower():
                if link not in pages and len(pages) < 100:
                    pages.append(link)

    # Crawl press-release detail pages discovered
    crawled = set()
    for url in list(pages):
        if url in crawled:
            continue
        crawled.add(url)
        if "detail" not in url and "press-release" not in url:
            continue
        code, final, data = fetch(url)
        html = data.decode("utf-8", "ignore")
        for m in re.findall(r'https?://d1io3yog0oux5\.cloudfront\.net/[^"\'\s<>]+\.pdf', html, re.I):
            all_pdfs.add(urllib.parse.unquote(m.replace("&amp;", "&")))
        for m in re.findall(r'/_f9ad8b88d669de65a966b7e00da37b99/equinix/[^"\'\s<>]+\.pdf', html, re.I):
            all_pdfs.add(urllib.parse.unquote(cdn + m.replace("&amp;", "&")))

    # Classify
    slides: dict[str, str] = {}
    filings: dict[str, str] = {}

    def qkey(text: str) -> str | None:
        t = text.upper().replace(" ", "")
        # Q2 2026 / Q2'26 / 2Q26 / Q226
        m = re.search(r"Q([1-4])[\s_+-]*(20)?(2[2-6])", text, re.I)
        if m:
            yy = m.group(3)
            year = 2000 + int(yy) if len(yy) == 2 else int(yy)
            if year < 2022 or year > 2026:
                return None
            return f"Q{m.group(1)} {year}"
        m = re.search(r"([1-4])Q[\s_+-]*(20)?(2[2-6])", text, re.I)
        if m:
            yy = m.group(3)
            year = 2000 + int(yy) if len(yy) == 2 else int(yy)
            if year < 2022 or year > 2026:
                return None
            return f"Q{m.group(1)} {year}"
        # FY / full year as Q4
        m = re.search(r"(?:FY|FULL[\s_-]*YEAR|YEAR[\s_-]*END)[\s_+-]*(20)?(2[2-6])", text, re.I)
        if m:
            yy = m.group(2)
            year = 2000 + int(yy) if len(yy) == 2 else int(yy)
            return f"Q4 {year}"
        return None

    for u in sorted(all_pdfs):
        name = urllib.parse.unquote(u.split("/")[-1])
        path_l = u.lower()
        q = qkey(name) or qkey(u)
        if not q:
            continue
        if "earnings_presentation" in path_l or (
            "presentation" in path_l and "earnings" in path_l and "intro" not in path_l
        ):
            if "presentation" in name.lower() or "earnings_presentation" in path_l:
                slides.setdefault(q, u)
        elif "earnings_release" in path_l or (
            ("press" in name.lower() or "release" in name.lower() or "financials" in name.lower())
            and "presentation" not in name.lower()
        ):
            filings.setdefault(q, u)

    # Expand by probing db folder listing? cloudfront won't list. Try Wayback or guess IDs from home.
    # Parse home for event IDs: /db/2183/27054/
    home_code, _, home = fetch(f"{base}/")
    home_html = home.decode("utf-8", "ignore")
    (OUT / "eqix-home.html").write_bytes(home)
    ids = sorted(set(re.findall(r"/equinix/db/2183/(\d+)/", home_html)))
    print("EQIX event ids on home:", ids)

    # Fetch events-presentations and press list more carefully via site search
    # Try equinix IR "financials/quarterly-results" content via stockpr widget API
    # Common: https://investor.equinix.com/feed/Earnings.rss or similar
    for extra in [
        f"{base}/news-events/events-presentations/default.aspx",
        f"{base}/financials/sec-filings",
        "https://investor.equinix.com/node/2183",
    ]:
        code, final, data = fetch(extra)
        html = data.decode("utf-8", "ignore")
        page_notes.append(f"extra {code} {final} bytes={len(data)}")
        for m in re.findall(r'https?://d1io3yog0oux5\.cloudfront\.net/[^"\'\s<>]+\.pdf', html, re.I):
            all_pdfs.add(urllib.parse.unquote(m.replace("&amp;", "&")))

    # Re-classify after extras
    for u in sorted(all_pdfs):
        name = urllib.parse.unquote(u.split("/")[-1])
        path_l = u.lower()
        q = qkey(name) or qkey(u)
        if not q:
            continue
        if "earnings_presentation" in path_l or (
            "presentation" in name.lower() and "earnings" in (name.lower() + path_l) and "intro" not in path_l
        ):
            slides.setdefault(q, u)
        elif "earnings_release" in path_l or (
            ("press" in name.lower() or "release" in name.lower()) and "presentation" not in name.lower()
        ):
            filings.setdefault(q, u)

    print("EQIX all_pdfs sample:")
    for u in sorted(all_pdfs):
        if "earnings" in u.lower() or re.search(r"Q[1-4]", u, re.I):
            print(" ", u)

    # Try Wayback CDX for equinix earnings pdfs
    cdx = (
        "https://web.archive.org/cdx/search/cdx?url=d1io3yog0oux5.cloudfront.net/*equinix*Earnings*"
        "&output=json&fl=original&collapse=urlkey&limit=500"
    )
    code, _, data = fetch(cdx, timeout=60)
    if data.startswith(b"["):
        try:
            rows = json.loads(data)
            for row in rows[1:]:
                u = row[0]
                if not u.lower().endswith(".pdf"):
                    continue
                if "earnings" not in u.lower():
                    continue
                all_pdfs.add(urllib.parse.unquote(u))
        except Exception as e:
            print("CDX parse fail", e)
    print("EQIX pdfs after wayback:", len(all_pdfs))

    slides.clear()
    filings.clear()
    for u in sorted(all_pdfs):
        name = urllib.parse.unquote(u.split("/")[-1])
        path_l = u.lower()
        q = qkey(name) or qkey(u)
        if not q:
            continue
        is_pres = "earnings_presentation" in path_l or (
            "presentation" in name.lower() and "earnings" in name.lower() and "intro" not in name.lower()
        )
        is_rel = "earnings_release" in path_l or (
            ("press" in name.lower() or "release" in name.lower() or "financials" in name.lower())
            and "presentation" not in name.lower()
            and "earnings" in (name.lower() + path_l)
        )
        if is_pres:
            slides.setdefault(q, u)
        elif is_rel:
            filings.setdefault(q, u)

    quarters = {}
    for y in range(2022, 2027):
        for q in range(1, 5):
            if y == 2026 and q > 2:
                continue
            key = f"Q{q} {y}"
            s = slides.get(key)
            f = filings.get(key)
            entry = {}
            if s:
                entry["slides"] = s
            if f:
                entry["filings"] = f
            quarters[key] = entry

    green = yellow = red = 0
    for k, v in quarters.items():
        has_s = bool(v.get("slides"))
        has_f = bool(v.get("filings"))
        if has_s and has_f and v.get("slides") != v.get("filings"):
            green += 1
        elif has_s or has_f:
            yellow += 1
        else:
            red += 1
    light = "green" if red == 0 and yellow == 0 else ("yellow" if green or yellow else "red")

    catalog = {
        "ticker": "EQIX",
        "fyEnd": "Dec 31",
        "irHub": "https://investor.equinix.com/financials/quarterly-results",
        "pdfHost": "d1io3yog0oux5.cloudfront.net/.../equinix/db/",
        "trafficLight": light,
        "notes": (
            "Earnings Presentation→slides; Earnings Press Release and Financials→filings. "
            "Stockpr/Cloudfront. Never 10-Q/proxy/Intro IR decks. "
            f"counts g/y/r={green}/{yellow}/{red}. pages={page_notes[:8]}"
        ),
        "quarters": quarters,
        "_debug_pdfs": sorted(all_pdfs),
    }
    return catalog


# ---------- CAIXY ----------
def discover_caixy() -> dict:
    base = "https://www.caixabank.com"
    url = f"{base}/en/shareholders-investors/economic-financial-information/quarterly-financial-information.html"
    code, final, data = fetch(url)
    html = data.decode("utf-8", "ignore")
    (OUT / "caixy-quarterly.html").write_bytes(data)

    hrefs = all_hrefs(html)
    # Fix broken duplicated paths in hrefs
    fixed = []
    for h in hrefs:
        h = h.replace("&amp;", "&")
        # broken: /deployedfiles/.../caixabank_com/Estaticos/... duplicated
        while "/caixabank_com/Estaticos/PDFs/Accionistasinversores/caixabank_com/" in h:
            h = h.replace(
                "/caixabank_com/Estaticos/PDFs/Accionistasinversores/caixabank_com/",
                "/caixabank_com/",
                1,
            )
        if h.startswith("/"):
            h = base + h
        fixed.append(h)

    def map_quarter(name: str) -> str | None:
        n = name.upper()
        # Spanish: 1T=Q1, 2T=Q2, 3T=Q3, 4T=Q4, 1S=H1→Q2, FY
        # Patterns: IF_2T26, Webcast_2T26, IF_1T_25, IFENG3T24, InformeFinanciero3T22
        m = re.search(r"(?:IF|INFORME|WEBCAST|OIR)[^/]*?([1-4])T[_\s-]*(20)?([0-9]{2})", n)
        if not m:
            m = re.search(r"([1-4])T[_\s-]*(20)?([0-9]{2})", n)
        if m:
            q = int(m.group(1))
            yy = m.group(3)
            year = 2000 + int(yy)
            if 2022 <= year <= 2026:
                return f"Q{q} {year}"
        m = re.search(r"FY(20)?([0-9]{2})|WEBCAST_?(20)?([0-9]{2})(?:_EN)?\.PDF|WEBCAST_(20)?([0-9]{4})", n)
        # FY2025 webcast → Q4 2025
        m = re.search(r"FY[\s_-]*(20)?([0-9]{2})", n)
        if m:
            yy = m.group(2)
            year = 2000 + int(yy) if len(yy) == 2 else int(yy)
            if 2022 <= year <= 2026:
                return f"Q4 {year}"
        m = re.search(r"WEBCAST[_\s-]*(20)([0-9]{2})[_\s-]*EN", n)
        if m:
            year = int(m.group(1) + m.group(2))
            if 2022 <= year <= 2026:
                return f"Q4 {year}"
        # 1S = first half → map to Q2 for slides if needed; still quarterly IF exists
        m = re.search(r"1S[_\s-]*(20)?([0-9]{2})", n)
        if m:
            yy = m.group(2)
            year = 2000 + int(yy)
            if 2022 <= year <= 2026:
                return f"Q2 {year}"
        return None

    slides: dict[str, str] = {}
    filings: dict[str, str] = {}
    for h in fixed:
        if not h.lower().endswith(".pdf"):
            continue
        if "deployedfiles" not in h.lower():
            continue
        name = urllib.parse.unquote(h.split("/")[-1])
        q = map_quarter(name)
        if not q:
            # try path
            q = map_quarter(h)
        if not q:
            continue
        nl = name.lower()
        if "webcast" in nl:
            slides.setdefault(q, h)
        elif nl.startswith("if") or "informe" in nl or "financiero" in nl or "financial" in nl:
            filings.setdefault(q, h)

    quarters = {}
    for y in range(2022, 2027):
        for q in range(1, 5):
            if y == 2026 and q > 2:
                continue
            key = f"Q{q} {y}"
            entry = {}
            if key in slides:
                entry["slides"] = slides[key]
            if key in filings:
                entry["filings"] = filings[key]
            quarters[key] = entry

    green = yellow = red = 0
    for v in quarters.values():
        has_s, has_f = bool(v.get("slides")), bool(v.get("filings"))
        if has_s and has_f and v.get("slides") != v.get("filings"):
            green += 1
        elif has_s or has_f:
            yellow += 1
        else:
            red += 1
    light = "green" if red == 0 and yellow == 0 else ("yellow" if green or yellow else "red")

    return {
        "ticker": "CAIXY",
        "fyEnd": "calendar",
        "irHub": url,
        "pdfHost": "www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/...",
        "trafficLight": light,
        "notes": (
            "Webcast_*→slides (earnings call deck); IF_*/InformeFinanciero→filings (quarterly financial report). "
            "Calendar FY; quarterly. Never Investor Day / conference decks. "
            f"counts g/y/r={green}/{yellow}/{red}"
        ),
        "quarters": quarters,
    }


# ---------- ING ----------
def discover_ing() -> dict:
    base = "https://www.ing.com"
    slides: dict[str, str] = {}
    filings: dict[str, str] = {}

    # Yearly results pages + presentations hub
    urls = [f"{base}/investors/presentations/quarterly-results-presentations"]
    for y in range(2022, 2027):
        urls.append(f"{base}/investors/financial-performance/quarterly-results/{y}")

    all_pdf_hrefs: list[str] = []
    for url in urls:
        code, final, data = fetch(url)
        html = data.decode("utf-8", "ignore")
        safe = url.rstrip("/").split("/")[-1]
        (OUT / f"ing-{safe}.html").write_bytes(data)
        print(f"ING {code} {final} bytes={len(data)}")
        for h in all_hrefs(html):
            h = h.replace("&amp;", "&")
            if ".pdf" not in h.lower():
                continue
            if h.startswith("/"):
                h = base + h
            all_pdf_hrefs.append(h)

    def q_from_ing(path: str) -> str | None:
        p = path.lower()
        # 2q2026, 1q2026, 4qfy2025, 3q2025, 4qfy2024
        m = re.search(r"([1-4])q(?:fy)?(20[2-6][0-9])", p)
        if m:
            return f"Q{m.group(1)} {m.group(2)}"
        m = re.search(r"([1-4])q(20[2-6][0-9])", p)
        if m:
            return f"Q{m.group(1)} {m.group(2)}"
        # ing-results-presentation-4q2022
        m = re.search(r"([1-4])q(20[2-6][0-9])", p)
        if m:
            return f"Q{m.group(1)} {m.group(2)}"
        return None

    for h in all_pdf_hrefs:
        hl = h.lower()
        q = q_from_ing(hl)
        if not q:
            continue
        # skip non-earnings
        if any(
            x in hl
            for x in [
                "fixed-income",
                "fixed_income",
                "profile",
                "historical-trend",
                "factsheet",
                "pillar",
                "russia",
                "ukraine",
            ]
        ):
            continue
        if "press-release" in hl or "press_release" in hl:
            filings.setdefault(q, h)
        elif "results-presentation" in hl or "results_presentation" in hl or "quarterly-results-presentation" in hl:
            slides.setdefault(q, h)
        elif "analyst-presentation" in hl:
            # older naming — treat as slides
            slides.setdefault(q, h)

    quarters = {}
    for y in range(2022, 2027):
        for q in range(1, 5):
            if y == 2026 and q > 2:
                continue
            key = f"Q{q} {y}"
            entry = {}
            if key in slides:
                entry["slides"] = slides[key]
            if key in filings:
                entry["filings"] = filings[key]
            quarters[key] = entry

    green = yellow = red = 0
    for v in quarters.values():
        has_s, has_f = bool(v.get("slides")), bool(v.get("filings"))
        if has_s and has_f and v.get("slides") != v.get("filings"):
            green += 1
        elif has_s or has_f:
            yellow += 1
        else:
            red += 1
    light = "green" if red == 0 and yellow == 0 else ("yellow" if green or yellow else "red")

    return {
        "ticker": "ING",
        "fyEnd": "calendar",
        "irHub": "https://www.ing.com/investors/financial-performance/quarterly-results",
        "pdfHost": "ing.com/binaries/content/assets/documents/",
        "trafficLight": light,
        "notes": (
            "results-presentation→slides; press-release.pdf→filings. "
            "Skip fixed-income/profile/factsheet/pillar III. "
            f"counts g/y/r={green}/{yellow}/{red}"
        ),
        "quarters": quarters,
    }


def verify_catalog(cat: dict) -> dict:
    ok = 0
    bad = 0
    for q, entry in cat["quarters"].items():
        for kind in ("slides", "filings"):
            u = entry.get(kind)
            if not u:
                continue
            good = head_pdf(u)
            print(f"  {'OK' if good else 'BAD'} {cat['ticker']} {q} {kind}: {u[:100]}")
            if good:
                ok += 1
            else:
                bad += 1
                entry.pop(kind, None)
    # recompute light
    green = yellow = red = 0
    for v in cat["quarters"].values():
        has_s, has_f = bool(v.get("slides")), bool(v.get("filings"))
        if has_s and has_f and v.get("slides") != v.get("filings"):
            green += 1
        elif has_s or has_f:
            yellow += 1
        else:
            red += 1
    cat["trafficLight"] = "green" if red == 0 and yellow == 0 else ("yellow" if green or yellow else "red")
    cat["notes"] = cat.get("notes", "") + f" verified ok/bad={ok}/{bad} final g/y/r={green}/{yellow}/{red}"
    return cat


def strip_debug(cat: dict) -> dict:
    return {k: v for k, v in cat.items() if not k.startswith("_")}


def main():
    print("=== CAIXY ===")
    caixy = discover_caixy()
    caixy = verify_catalog(caixy)
    (OUT / "caixy-catalog.json").write_text(json.dumps(strip_debug(caixy), indent=2) + "\n")
    print("CAIXY", caixy["trafficLight"])

    print("=== ING ===")
    ing = discover_ing()
    ing = verify_catalog(ing)
    (OUT / "ing-catalog.json").write_text(json.dumps(strip_debug(ing), indent=2) + "\n")
    print("ING", ing["trafficLight"])

    print("=== EQIX ===")
    eqix = discover_eqix()
    # don't verify huge debug list yet — verify only catalogued
    dbg = eqix.pop("_debug_pdfs", [])
    (OUT / "eqix-debug-pdfs.json").write_text(json.dumps(dbg, indent=2) + "\n")
    eqix = verify_catalog(eqix)
    (OUT / "eqix-catalog.json").write_text(json.dumps(strip_debug(eqix), indent=2) + "\n")
    print("EQIX", eqix["trafficLight"])

    # brief stdout
    for cat in (eqix, caixy, ing):
        print(f"\n{cat['ticker']} [{cat['trafficLight']}] host={cat['pdfHost']}")
        for q, e in cat["quarters"].items():
            s = "S" if e.get("slides") else "-"
            f = "F" if e.get("filings") else "-"
            color = "green" if s == "S" and f == "F" else ("yellow" if s == "S" or f == "F" else "red")
            print(f"  {color:6} {q}: slides={s} filings={f}")


if __name__ == "__main__":
    main()
