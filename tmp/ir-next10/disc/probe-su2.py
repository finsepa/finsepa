#!/usr/bin/env python3
"""Probe Suncor PDFs via sustainability CDN (often less Cloudflare)."""
import json
import urllib.error
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent
HOSTS = [
    "https://www.suncor.com",
    "https://sustainability-prd-cdn.suncor.com",
]
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}


def probe(url: str) -> dict:
    req = urllib.request.Request(url, headers={**UA, "Range": "bytes=0-7"})
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            body = resp.read(8)
            return {"code": getattr(resp, "status", 200), "pdf": body.startswith(b"%PDF")}
    except urllib.error.HTTPError as e:
        body = e.read(8) if e.fp else b""
        return {"code": e.code, "pdf": body.startswith(b"%PDF")}
    except Exception as e:
        return {"code": None, "err": str(e), "pdf": False}


rows = []
for y in range(2022, 2027):
    maxq = 2 if y == 2026 else 4
    for q in range(1, maxq + 1):
        slides = None
        filings = None
        slide_paths = [
            f"/-/media/project/suncor/files/investor-centre/investor-relations-presentations-{y}/{y}-q{q}-suncor-energy-investor-presentation-en.pdf",
            f"/-/media/project/suncor/files/investor-centre/investor-relations-presentations/{y}-q{q}-suncor-energy-investor-presentation-en.pdf",
            f"/-/media/project/suncor/files/investor-centre/investor-relations-presentations-{y}/{y}-q{q}-investor-presentation-en.pdf",
        ]
        filing_paths = [
            f"/-/media/project/suncor/files/investor-centre/quarterly-reports-{y}/{y}-q{q}-suncor-energy-quarterly-report-en.pdf",
            f"/-/media/project/suncor/files/investor-centre/quarterly-reports/{y}-q{q}-suncor-energy-quarterly-report-en.pdf",
            f"/-/media/project/suncor/files/investor-centre/financial-reports/{y}/q{q}/suncor-energy-quarterly-report-en.pdf",
        ]
        for host in HOSTS:
            if slides:
                break
            for p in slide_paths:
                r = probe(host + p)
                print(f"S Q{q}{y} {r.get('code')} pdf={r.get('pdf')} {host.split('//')[1][:20]} {p.split('/')[-1]}")
                if r.get("pdf"):
                    slides = host + p
                    break
        for host in HOSTS:
            if filings:
                break
            for p in filing_paths:
                r = probe(host + p)
                print(f"F Q{q}{y} {r.get('code')} pdf={r.get('pdf')} {host.split('//')[1][:20]} {p.split('/')[-1]}")
                if r.get("pdf"):
                    filings = host + p
                    break
        rows.append({"label": f"Q{q} {y}", "slides": slides, "filings": filings})

(OUT / "su-probe2.json").write_text(json.dumps(rows, indent=2))
for r in rows:
    print(r["label"], "S" if r["slides"] else "-", "F" if r["filings"] else "-")
