#!/usr/bin/env python3
"""Probe Suncor IR PDF URL patterns and %PDF-verify."""
import json
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}


def probe(url: str) -> dict:
    req = urllib.request.Request(url, headers={**UA, "Range": "bytes=0-7"}, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read(8)
            code = getattr(resp, "status", 200)
            return {
                "url": url,
                "code": code,
                "magic": body[:5],
                "is_pdf": body.startswith(b"%PDF"),
            }
    except urllib.error.HTTPError as e:
        body = e.read(8) if e.fp else b""
        return {
            "url": url,
            "code": e.code,
            "magic": body[:5],
            "is_pdf": body.startswith(b"%PDF"),
        }
    except Exception as e:
        return {"url": url, "code": None, "error": str(e), "is_pdf": False}


quarters = []
# calendar FY Q1 2022 -> Q2 2026
for y in range(2022, 2027):
    qs = [1, 2, 3, 4]
    if y == 2026:
        qs = [1, 2]
    for q in qs:
        quarters.append((y, q))

rows = []
for y, q in quarters:
    slides_cands = [
        f"https://www.suncor.com/-/media/project/suncor/files/investor-centre/investor-relations-presentations-{y}/{y}-q{q}-suncor-energy-investor-presentation-en.pdf",
        f"https://www.suncor.com/-/media/project/suncor/files/investor-centre/investor-relations-presentations-{y}/{y}-q{q}-investor-presentation-en.pdf",
        f"https://www.suncor.com/-/media/project/suncor/files/investor-centre/investor-relations-presentations/{y}-q{q}-suncor-energy-investor-presentation-en.pdf",
    ]
    filings_cands = [
        f"https://www.suncor.com/-/media/project/suncor/files/investor-centre/quarterly-reports-{y}/{y}-q{q}-suncor-energy-quarterly-report-en.pdf",
        f"https://www.suncor.com/-/media/project/suncor/files/investor-centre/quarterly-reports/{y}-q{q}-suncor-energy-quarterly-report-en.pdf",
        f"https://www.suncor.com/-/media/project/suncor/files/investor-centre/financial-reports/{y}-q{q}-suncor-energy-quarterly-report-en.pdf",
    ]
    slides = None
    filings = None
    for u in slides_cands:
        r = probe(u)
        print(f"slides Q{q} {y}: {r.get('code')} pdf={r.get('is_pdf')} {u.split('/')[-1]}")
        if r.get("is_pdf"):
            slides = u
            break
    for u in filings_cands:
        r = probe(u)
        print(f"filings Q{q} {y}: {r.get('code')} pdf={r.get('is_pdf')} {u.split('/')[-1]}")
        if r.get("is_pdf"):
            filings = u
            break
    rows.append({"label": f"Q{q} {y}", "slides": slides, "filings": filings})

(OUT / "su-probe.json").write_text(json.dumps(rows, indent=2))
print("DONE", OUT / "su-probe.json")
for r in rows:
    print(r["label"], "S" if r["slides"] else "-", "F" if r["filings"] else "-")
