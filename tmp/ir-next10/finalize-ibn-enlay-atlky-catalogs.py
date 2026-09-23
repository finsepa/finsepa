#!/usr/bin/env python3
"""Patch and re-verify IBN/ENLAY/ATLKY catalogs."""
import json
import ssl
import time
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
CTX = ssl.create_default_context()
LATEST = (2026, 2)


def quarter_keys():
    keys = []
    y, q = 2022, 1
    while (y, q) <= LATEST:
        keys.append(f"Q{q} {y}")
        q += 1
        if q > 4:
            q = 1
            y += 1
    return keys


def pdf_ok(url: str) -> bool:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Range": "bytes=0-4"})
    try:
        with urllib.request.urlopen(req, context=CTX, timeout=25) as r:
            return r.read(5).startswith(b"%PDF")
    except Exception:
        return False


def quarter_color(entry: dict) -> str:
    s, f = entry.get("slides"), entry.get("filings")
    if s and f and s != f:
        return "green"
    if s or f:
        return "yellow"
    return "red"


def verify(quarters: dict) -> dict:
    ok = bad = 0
    g = y = r = 0
    for entry in quarters.values():
        c = quarter_color(entry)
        g += c == "green"
        y += c == "yellow"
        r += c == "red"
        for k in ("slides", "filings"):
            u = entry.get(k)
            if not u:
                continue
            if pdf_ok(u):
                ok += 1
            else:
                bad += 1
            time.sleep(0.06)
    return {
        "method": "Range-GET bytes=0-4",
        "ok": ok,
        "bad": bad,
        "quarterCounts": {"green": g, "yellow": y, "red": r},
    }


def trim_and_finalize(cat: dict, patches: dict[str, dict]) -> dict:
    keys = quarter_keys()
    q = {k: patches.get(k, cat["quarters"].get(k, {"slides": None, "filings": None})) for k in keys}
    v = verify(q)
    cat["quarters"] = q
    cat["verified"] = v
    if v["bad"]:
        cat["trafficLight"] = "yellow"
    elif v["quarterCounts"]["yellow"] or v["quarterCounts"]["red"]:
        cat["trafficLight"] = "yellow"
    else:
        cat["trafficLight"] = "green"
    return cat


ENEL_PRESS = {
    "Q1 2022": "https://www.enel.com/content/dam/enel-common/press/en/2022-may/Enel%20Results%20Q1%202022.pdf",
    "Q2 2022": "https://www.enel.com/content/dam/enel-common/press/en/2022-july/Enel%20Results%201H%202022.pdf",
    "Q3 2022": "https://www.enel.com/content/dam/enel-common/press/en/2022-november/Enel%20results%209M%202022.pdf",
    "Q4 2022": "https://www.enel.com/content/dam/enel-common/press/en/2023-march/Enel%20results%20FY%202022.pdf",
    "Q1 2023": "https://www.enel.com/content/dam/enel-common/press/en/2023-may/Enel%201Q%202023%20financial%20results.pdf",
    "Q2 2023": "https://www.enel.com/content/dam/enel-common/press/en/2023-july/Enel%20results%201H%202023.pdf",
    "Q3 2023": "https://www.enel.com/content/dam/enel-common/press/en/2023-november/Enel%20Results%209M%202023.pdf",
    "Q4 2023": "https://www.enel.com/content/dam/enel-common/press/en/2024-march/Enel%20FY%20Results%202023.pdf",
    "Q1 2024": "https://www.enel.com/content/dam/enel-common/press/en/2024-may/Enel%20results%201Q%202024.pdf",
    "Q2 2024": "https://www.enel.com/content/dam/enel-com/documenti/investitori/informazioni-finanziarie/2024/interim/en/half-year-financial-report_30june2024.pdf",
    "Q3 2024": "https://www.enel.com/content/dam/enel-common/press/en/2024-november/Enel%20results%209M%202024.pdf",
    "Q4 2024": "https://www.enel.com/content/dam/enel-common/press/en/2025-march/Enel%20results%20FY%202024ENG.pdf",
    "Q1 2025": "https://www.enel.com/content/dam/enel-common/press/en/2025-may/Enel%20results%201Q%202025.pdf",
    "Q2 2025": "https://www.enel.com/content/dam/enel-common/press/en/2025-july/Enel%20results%201H%202025.pdf",
    "Q3 2025": "https://www.enel.com/content/dam/enel-common/press/en/2025-november/Enel%20results%209M%202025.pdf",
}

ATLKY_PATCH = {
    "Q4 2022": {
        "slides": "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20230126-q4-en-handout-pm.pdf",
    },
    "Q4 2023": {
        "slides": "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20240125-q4-handout-2023-en-ok.pdf",
    },
    "Q2 2024": {
        "slides": "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20240718-q2-2024-handout-en-wn.pdf",
    },
    "Q4 2024": {
        "slides": "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20250128-quarterly-results-presentation-q4-2024-en-lg.pdf",
    },
    "Q2 2025": {
        "slides": "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20250718-quarterly-results-presentations-q2-2025-wg.pdf",
    },
    "Q4 2025": {
        "slides": "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20260127-quarterly-results-presentation-en-q4-2025.pdf",
    },
    "Q1 2026": {
        "slides": "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20260428-q1-2026-quarterly-results-presentation-en-ib.pdf",
    },
    "Q2 2026": {
        "slides": "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20260716-quarterly-results-presentations-q2-2026-en-fl.pdf",
    },
}


def main():
    keys = quarter_keys()

    ibn = json.loads((OUT / "ibn-catalog.json").read_text())
    ibn_p = {k: ibn["quarters"][k] for k in keys if k in ibn["quarters"]}
    ibn = trim_and_finalize(ibn, ibn_p)
    ibn["notes"] = (
        "ICICI Bank Ltd ADR. March FY (Q1=Jun…Q4=Mar, year=FY end). "
        "Slides=Investor Presentation; Filings=Performance Review/PR1 PDF on icici.bank.in. "
        f"Scope Q1 2022→Q2 2026. green/yellow/red={ibn['verified']['quarterCounts']['green']}/"
        f"{ibn['verified']['quarterCounts']['yellow']}/{ibn['verified']['quarterCounts']['red']}. "
        f"Range-GET ok/bad={ibn['verified']['ok']}/{ibn['verified']['bad']}."
    )

    enlay = json.loads((OUT / "enlay-catalog.json").read_text())
    en_p = {}
    for k in keys:
        base = enlay["quarters"].get(k, {"slides": None, "filings": None})
        en_p[k] = {
            "slides": base.get("slides"),
            "filings": ENEL_PRESS.get(k),
        }
    enlay = trim_and_finalize(enlay, en_p)
    enlay["notes"] = (
        "Enel SpA ADR. Calendar FY; 1Q/1H/9M/FY results. Slides=*-risultati.pdf; "
        "Filings=English press PDF (Q2 2024 uses half-year financial report — no separate 1H press PDF found). "
        "Q4 2025/Q2 2026 not yet published. "
        f"green/yellow/red={enlay['verified']['quarterCounts']['green']}/"
        f"{enlay['verified']['quarterCounts']['yellow']}/{enlay['verified']['quarterCounts']['red']}. "
        f"Range-GET ok/bad={enlay['verified']['ok']}/{enlay['verified']['bad']}."
    )

    atlky = json.loads((OUT / "atlky-catalog.json").read_text())
    at_p = {}
    for k in keys:
        slot = dict(atlky["quarters"].get(k, {"slides": None, "filings": None}))
        slot.update(ATLKY_PATCH.get(k, {}))
        at_p[k] = slot
    atlky = trim_and_finalize(atlky, at_p)
    atlky["notes"] = (
        "Atlas Copco AB ADR via atlascopcogroup.com. Calendar quarterly: interim report (filings) + "
        "handout/presentation PDF (slides). Scope Q1 2022→Q2 2026. "
        f"green/yellow/red={atlky['verified']['quarterCounts']['green']}/"
        f"{atlky['verified']['quarterCounts']['yellow']}/{atlky['verified']['quarterCounts']['red']}. "
        f"Range-GET ok/bad={atlky['verified']['ok']}/{atlky['verified']['bad']}."
    )

    for name, cat in (("ibn", ibn), ("enlay", enlay), ("atlky", atlky)):
        (OUT / f"{name}-catalog.json").write_text(json.dumps(cat, indent=2) + "\n")
        v = cat["verified"]
        print(
            f"{cat['ticker']} {cat['trafficLight']} "
            f"g/y/r={v['quarterCounts']['green']}/{v['quarterCounts']['yellow']}/{v['quarterCounts']['red']} "
            f"pdf={v['ok']}/{v['bad']}"
        )


if __name__ == "__main__":
    main()
