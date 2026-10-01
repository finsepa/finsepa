#!/usr/bin/env python3
"""Build CTAS and ARZGY catalogs; verify PDFs with Range GET %PDF."""
import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path("/Users/rakshamann/Desktop/Finsepa/tmp/ir-next10")
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}


def is_pdf(url: str) -> bool:
    req = urllib.request.Request(url, headers={**UA, "Range": "bytes=0-7"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read(5).startswith(b"%PDF")
    except urllib.error.HTTPError as e:
        body = e.read(5) if e.fp else b""
        # 206 Partial Content still fine
        return body.startswith(b"%PDF")
    except Exception:
        return False


def abs_gen(href: str) -> str:
    if href.startswith("http"):
        return href
    return "https://www.generali.com" + href


# ---- CTAS ----
CTAS_BASE = "https://www.cintas.com/docs/default-source/investor-relations/quarterly-reports/"
# May 31 FY; labels = issuer fiscal quarters
ctas_files = {
    "Q1 2022": "cintas-corporation-reports-first-quarter-fiscal-2022-revenue-and-earnings.pdf",
    "Q2 2022": "cintas-corporation-reports-second-quarter-fiscal-2022-revenue-and-earnings.pdf",
    "Q3 2022": "cintas-corporation-reports-third-quarter-fiscal-2022-revenue-and-earnings.pdf",
    "Q4 2022": "cintas-corporation-reports-fourth-quarter-fiscal-2022-revenue-and-earnings.pdf",
    "Q1 2023": "cintas-corporation-reports-first-quarter-fiscal-2023-revenue-and-earnings.pdf",
    "Q2 2023": "cintas-corporation-reports-second-quarter-fiscal-2023-revenue-and-earnings.pdf",
    "Q3 2023": "q3-fy'23-revenue-and-earnings.pdf",
    "Q4 2023": "q4-fy23-revenue-and-earnings.pdf",
    "Q1 2024": "q1-fy24-revenue-and-earnings.pdf",
    "Q2 2024": "q2-fy24-revenue-and-earnings.pdf",
    "Q3 2024": "q3-fy24-revenue-earnings.pdf",
    "Q4 2024": "q4-fy24-revenue-and-earnings.pdf",
    "Q1 2025": "q1-fy25-revenue-and-earnings.pdf",
    "Q2 2025": "q2-fy25-revenue-earnings.pdf",
    "Q3 2025": "q3-fy25-revenue-and-earnings.pdf",
    "Q4 2025": "q4-fy25-revenue-and-earnings.pdf",
    "Q1 2026": "q1-fy26-revenue-and-earnings.pdf",
    "Q2 2026": "q2-fy26-revenue-and-earnings.pdf",
    "Q3 2026": "q3-fy26-revenue-and-earnings.pdf",
    "Q4 2026": "q4-fy26-revenue-and-earnings.pdf",
}

ctas_quarters = {}
ctas_g = ctas_y = ctas_r = 0
for label, name in ctas_files.items():
    url = CTAS_BASE + urllib.parse.quote(name, safe="-._~'")
    # apostrophe in q3-fy'23 needs encoding as %27
    if "'" in name:
        url = CTAS_BASE + name.replace("'", "%27")
    ok = is_pdf(url)
    print(f"CTAS {label}: pdf={ok} {name}")
    slides = None
    filings = url if ok else None
    ctas_quarters[label] = {"slides": slides, "filings": filings}
    if slides and filings:
        ctas_g += 1
    elif slides or filings:
        ctas_y += 1
    else:
        ctas_r += 1

ctas = {
    "ticker": "CTAS",
    "irHost": "www.cintas.com/docs/default-source/investor-relations",
    "fyEnd": "05-31",
    "latestLabel": "Q4 2026",
    "trafficLight": "green" if ctas_r == 0 and ctas_y == 0 else ("yellow" if ctas_y or ctas_g else "red"),
    "quarters": ctas_quarters,
    "notes": (
        "Cintas May 31 FY. Labels = issuer fiscal Q1–Q4 (Q1 ends Aug 31, Q2 Nov 30, Q3 Feb 28/29, Q4 May 31). "
        "Filings-only: revenue-and-earnings press PDFs on cintas.com/docs/default-source/investor-relations/quarterly-reports "
        "(older long-form filenames; mid years drop 'and' or use q3-fy'23). No quarterly IR slide decks found. "
        "Reject 10-K/proxy/income-statement/balance-sheet/cash-flow standalone. Never SEC HTML. "
        f"Scope: {ctas_g}g / {ctas_y}y / {ctas_r}r."
    ),
    "counts": {"green": ctas_g, "yellow": ctas_y, "red": ctas_r},
}
# traffic light for filings-only all yellow
ctas["trafficLight"] = "yellow" if ctas_y and not ctas_r else ctas["trafficLight"]
if ctas_y and ctas_r == 0 and ctas_g == 0:
    ctas["trafficLight"] = "yellow"

(ROOT / "ctas-catalog.json").write_text(json.dumps(ctas, indent=2) + "\n")
print("wrote ctas", ctas["trafficLight"], ctas["counts"])

# ---- ARZGY ----
# Half-year European: 1H→Q2, FY→Q4; Q1/Q3 empty by design (1Q26 press exists but no decks; leave Q1 empty for consistency with AXAHY/BTI unless we fill filings-only)
pres = {
    "Q2 2022": "/doc/jcr:f659f183-a990-4493-be26-8864bd356dc2/Generali%201H22%20Results%20presentation.pdf/lang:en/Generali_1H22_Results_presentation.pdf",
    "Q4 2022": "/doc/jcr:c8771dae-6e87-466a-8af1-af97a147a0c3/Generali%202022%20Results_presentation.pdf/lang:en/Generali_2022_Results_presentation.pdf",
    "Q2 2023": "/doc/jcr:d447236f-dfe8-49c8-a961-c87d9e9735fe/Generali%201H23%20Results%20presentation_.pdf/lang:en/Generali_1H23_Results_presentation_.pdf",
    "Q4 2023": "/doc/jcr:e13aeb11-b93a-4f64-bad9-12e52f75c056/Generali_2023%20Results%20presentation%20and%20commentary.pdf/lang:en/Generali_2023_Results_presentation_and_commentary.pdf",
    "Q2 2024": "/doc/jcr:67a7449e-438d-485b-a02b-62c3c0c3d2cb/Generali%201H24%20Results%20presentation%20and%20slide%20commentary.pdf/lang:en/Generali_1H24_Results_presentation_and_slide_commentary.pdf",
    "Q4 2024": "/doc/jcr:a0bc24bd-89f3-4d8f-adaf-44313dff5ddb/Generali%20FY24%20presentation%20with%20commentary_.pdf/lang:en/Generali_FY24_presentation_with_commentary_.pdf",
    "Q2 2025": "/doc/jcr:f21cfbe3-92b7-4bd2-b6fd-d8f74c68a507/Generali%201H25%20presentation%20with%20commentary.pdf/lang:en/Generali_1H25_presentation_with_commentary.pdf",
    "Q4 2025": "/doc/jcr:72997b15-9217-4c80-a775-6329c207d1f1/Generali_FY25_presentation.pdf/lang:en/Generali_FY25_presentation.pdf",
    "Q2 2026": "/doc/jcr:04c63ae5-8c6e-4798-be33-60aa911f7adc/Generali%201H26_presentation.pdf/lang:en/Generali_1H26_presentation.pdf",
}
# FY2021 presentation maps to Q4 2021 — out of scope (before Q1 2022)
press = {
    "Q2 2022": "/doc/jcr:4aff4320-131f-49ff-b156-00a9c54fe080/PR_Generali%20Group%20HY2022%20Results%20_DEF.pdf/lang:en/PR_Generali_Group_HY2022_Results__DEF.pdf",
    "Q4 2022": "/doc/jcr:76592065-7ecf-4288-a4b8-41d0ea2a7151/03.14%20PR_Generali%20consolidated%20results%2031%20dec.2022_def_.pdf/lang:en/03.14_PR_Generali_consolidated_results_31_dec.2022_def_.pdf",
    "Q2 2023": "/doc/jcr:18ba26c2-5ea6-4c7f-8593-a1979c517993/08.09%20PR_Generali%20Group%20HY2023%20Results%20def.pdf/lang:en/08.09_PR_Generali_Group_HY2023_Results_def.pdf",
    "Q4 2023": "/doc/jcr:fb6c310f-ad47-46d5-9255-84ae36407f2a/03.12_PR_Generali%20consolidated%20results%2031%20dec%202023.pdf/lang:en/03.12_PR_Generali_consolidated_results_31_dec_2023.pdf",
    "Q2 2024": "/doc/jcr:6053c4b3-24a8-45e3-986a-f0e5f7294570/08.09%20PR_Generali%20Group%20HY2024%20Results_def.pdf/lang:en/08.09_PR_Generali_Group_HY2024_Results_def.pdf",
    "Q4 2024": "/doc/jcr:69aa7673-1600-4d92-b710-d61f6e716536/03.12%20PR_Generali%20Consolidated%20Results%202024_def.pdf/lang:en/03.12_PR_Generali_Consolidated_Results_2024_def.pdf",
    "Q2 2025": "/doc/jcr:a37f79ab-a0b0-4779-a32a-79c9df4cd66a/08.06%20PR_Generali%20Group%20HY2025%20Results_def.pdf/lang:en/08.06_PR_Generali_Group_HY2025_Results_def.pdf",
    "Q4 2025": "/doc/jcr:b2b5f8a5-caa1-4153-bd44-a504ab8b8a9c/03.12%20PR_Generali%20Consolidated%20Results%202025_def-.pdf/lang:en/03.12_PR_Generali_Consolidated_Results_2025_def-.pdf",
    "Q2 2026": "/doc/jcr:ea1a9348-6936-4696-802d-acb7b01f4159/08.06%20PR_Generali%20Consolidated%20Results%201H2026_def.pdf/lang:en/08.06_PR_Generali_Consolidated_Results_1H2026_def.pdf",
}

# Build Q1 2022 -> Q2 2026 (latest is 1H26)
labels = []
for y in range(2022, 2027):
    for q in (1, 2, 3, 4):
        if y == 2026 and q > 2:
            break
        labels.append(f"Q{q} {y}")

arzgy_q = {}
g = y = r = 0
for label in labels:
    s = abs_gen(pres[label]) if label in pres else None
    f = abs_gen(press[label]) if label in press else None
    if s and not is_pdf(s):
        print("ARZGY slides BAD", label, s)
        s = None
    if f and not is_pdf(f):
        print("ARZGY filings BAD", label, f)
        f = None
    if s:
        print("ARZGY slides OK", label)
    if f:
        print("ARZGY filings OK", label)
    arzgy_q[label] = {"slides": s, "filings": f}
    if s and f:
        g += 1
    elif s or f:
        y += 1
    else:
        r += 1

arzgy = {
    "ticker": "ARZGY",
    "irHost": "www.generali.com",
    "fyEnd": "12-31",
    "latestLabel": "Q2 2026",
    "trafficLight": "yellow",
    "quarters": arzgy_q,
    "notes": (
        "Assicurazioni Generali ADR. Calendar FY but half-year European reporting: 1H→Q2, FY/YE→Q4; Q1/Q3 empty by design "
        "(occasional 1Q press e.g. 1Q26 not locked — no decks). "
        "Slides=Presentation of Results on generali.com/doc/jcr; Filings=Consolidated Results press PDF. "
        "Reject transcripts/deep-dives/Investor Day/comparatives. Never SEC HTML. "
        f"Scope: {g}g / {y}y / {r}r."
    ),
    "counts": {"green": g, "yellow": y, "red": r},
}
(ROOT / "arzgy-catalog.json").write_text(json.dumps(arzgy, indent=2) + "\n")
print("wrote arzgy", arzgy["counts"])
