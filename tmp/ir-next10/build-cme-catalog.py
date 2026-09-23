#!/usr/bin/env python3
"""Build tmp/ir-next10/cme-catalog.json from events iframe + known UUIDs."""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
IFRAME = ROOT / "cme-events-iframe.html"
OUT = ROOT / "cme-catalog.json"
BASE = "https://investor.cmegroup.com"
UA = "Mozilla/5.0"

# Quarters not in Jul-2025 wayback iframe (or newer than snapshot)
PATCH: dict[str, dict[str, str]] = {
    "Q3 2025": {
        "slides": f"{BASE}/static-files/aca21328-ee0f-4e33-9ad4-21653c7c42ba",
        "filings": f"{BASE}/static-files/77d5516d-77e2-4057-9474-70863c923d97",
    },
    "Q4 2025": {
        "slides": f"{BASE}/static-files/de615c20-4d59-44b4-9495-fbe97084aae4",
        "filings": f"{BASE}/static-files/ac5c7e05-582e-4e53-be77-6b173a1bf745",
    },
    "Q1 2026": {
        "slides": f"{BASE}/static-files/267f35bc-9747-4ab3-bd7f-a47c4cc1e349",
        "filings": f"{BASE}/static-files/fa9991f8-5049-4205-aac2-4ce5dba85daf",
    },
    "Q2 2026": {
        "slides": f"{BASE}/static-files/28726886-6ee8-4788-b33b-0087545861f4",
        "filings": f"{BASE}/static-files/88654e47-66b8-4a4a-8093-cc60ddeb103e",
    },
}


def quarter_keys_through(end_y: int, end_q: int) -> list[str]:
    keys: list[str] = []
    y, q = 2022, 1
    while (y, q) <= (end_y, end_q):
        keys.append(f"Q{q} {y}")
        q += 1
        if q > 4:
            q = 1
            y += 1
    return keys


def parse_iframe(html: str) -> dict[str, dict[str, str | None]]:
    quarters: dict[str, dict[str, str | None]] = {}
    headers = re.findall(
        r'<div class="field__item">(CME Group Inc\.[^<]*(?:First|Second|Third|Fourth)[^<]*(?:20\d{2})[^<]*Earnings Conference Call)</div>',
        html,
        flags=re.I,
    )
    chunks = re.split(
        r'<div class="field__item">CME Group Inc\.[^<]*(?:First|Second|Third|Fourth)[^<]*(?:20\d{2})[^<]*Earnings Conference Call</div>',
        html,
        flags=re.I,
    )
    qmap = {"first": 1, "second": 2, "third": 3, "fourth": 4}
    for header, chunk in zip(headers, chunks[1:]):
        m = re.search(
            r"(First|Second|Third|Fourth)[-\s]Quarter(?: and Year-End)?\s+(20\d{2})",
            header,
            re.I,
        )
        if not m:
            continue
        qk = f"Q{qmap[m.group(1).lower()]} {m.group(2)}"
        if int(m.group(2)) < 2022:
            continue
        slides = filings = None
        for hm in re.finditer(
            r'href="(/static-files/[a-f0-9-]+)"[^>]*>([^<]+)</a>',
            chunk,
            re.I,
        ):
            href, label = hm.group(1), hm.group(2).strip().lower()
            url = BASE + href
            if "earnings press release" in label:
                filings = url
            elif "earnings commentary" in label or "quarterly earnings commentary" in label:
                slides = url
        if slides or filings:
            quarters.setdefault(qk, {"slides": None, "filings": None})
            if slides:
                quarters[qk]["slides"] = slides
            if filings:
                quarters[qk]["filings"] = filings
    return quarters


def pdf_ok(url: str) -> bool:
    wb = f"https://web.archive.org/web/20251201000000id_/{url}"
    for u in (wb, url):
        try:
            data = subprocess.check_output(
                [
                    "curl",
                    "-sL",
                    "--max-time",
                    "12",
                    "-A",
                    UA,
                    "-H",
                    "Range: bytes=0-4",
                    u,
                ],
                stderr=subprocess.DEVNULL,
            )
            if data[:5].startswith(b"%PDF"):
                return True
        except Exception:
            continue
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
                print("BAD", u)
    return {
        "method": "Range-GET bytes=0-4",
        "ok": ok,
        "bad": bad,
        "quarterCounts": {"green": g, "yellow": y, "red": r},
    }


def main() -> None:
    html = IFRAME.read_text(encoding="utf-8", errors="replace")
    parsed = parse_iframe(html)
    for qk, slot in PATCH.items():
        parsed[qk] = slot

    scope = quarter_keys_through(2026, 2)
    quarters = {qk: parsed.get(qk, {"slides": None, "filings": None}) for qk in scope}
    verified = verify(quarters)
    qc = verified["quarterCounts"]
    if verified["bad"]:
        light = "yellow"
    elif qc["red"] == 0 and qc["yellow"] == 0:
        light = "green"
    elif qc["green"] == 0 and qc["yellow"] == 0:
        light = "red"
    else:
        light = "yellow"

    cat = {
        "ticker": "CME",
        "fyEnd": "12-31",
        "irPages": [
            "https://investor.cmegroup.com",
            "https://investor.cmegroup.com/events-and-presentations",
            "https://investor.cmegroup.com/events-and-presentations-iframe",
            "https://www.cmegroup.com/investor-relations/financial-information.html",
        ],
        "pdfHost": "investor.cmegroup.com/static-files",
        "trafficLight": light,
        "notes": (
            "CME Group calendar FY (Dec). Drupal IR: Slides=Quarterly Earnings Commentary; "
            "Filings=Earnings Press Release on investor.cmegroup.com/static-files (events iframe). "
            "Never intro scripts, income trends, 10-Q, or SEC HTML. "
            f"Scope Q1 2022→Q2 2026. Counts green={qc['green']} yellow={qc['yellow']} red={qc['red']}. "
            f"Range-GET ok/bad={verified['ok']}/{verified['bad']}. "
            "Blocker: live cmegroup.com/investor blocks automated fetch; discovery via wayback iframe + event UUIDs."
        ),
        "quarters": quarters,
        "verified": verified,
    }
    OUT.write_text(json.dumps(cat, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUT} light={light} verified={verified}")


if __name__ == "__main__":
    main()
