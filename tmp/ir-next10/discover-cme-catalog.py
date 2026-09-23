#!/usr/bin/env python3
"""Build CME IR vault catalog from investor.cmegroup.com events iframe (wayback)."""
from __future__ import annotations

import json
import re
import ssl
import subprocess
import time
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent / "cme-catalog.json"
BASE = "https://investor.cmegroup.com"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
CTX = ssl.create_default_context()

# Known recent quarters from web search / prior discovery (iframe may lag on wayback)
MANUAL: dict[str, dict[str, str]] = {
    "Q3 2025": {
        "slides": f"{BASE}/static-files/PLACEHOLDER_Q3_2025_COMMENTARY",
        "filings": f"{BASE}/static-files/PLACEHOLDER_Q3_2025_PR",
    },
    "Q4 2025": {
        "slides": f"{BASE}/static-files/de615c20-4d59-44b4-9495-fbe97084aae4",
        "filings": None,  # filled from parse or gcs
    },
    "Q1 2026": {
        "slides": f"{BASE}/static-files/267f35bc-9747-4ab3-bd7f-a47c4cc1e349",
        "filings": None,
    },
    "Q2 2026": {
        "slides": None,
        "filings": None,
    },
}

WAYBACK_SNAPSHOTS = [
    "20250722120000",
    "20260204120000",
    "20260423120000",
    "20260723120000",
    "20251021120000",
]


def curl_bytes(url: str, timeout: int = 90) -> bytes:
    cmd = ["curl", "-sL", "--max-time", str(timeout), "-A", UA, url]
    return subprocess.check_output(cmd)


def fetch_iframe_html() -> str:
    for ts in WAYBACK_SNAPSHOTS:
        url = f"https://web.archive.org/web/{ts}id_/https://investor.cmegroup.com/events-and-presentations-iframe"
        try:
            raw = curl_bytes(url, timeout=120)
        except Exception as e:
            print(f"skip snapshot {ts}: {e}")
            continue
        if len(raw) < 5000 or b"Earnings Press Release" not in raw:
            print(f"skip snapshot {ts}: short or no earnings ({len(raw)} bytes)")
            continue
        print(f"using wayback snapshot {ts} ({len(raw)} bytes)")
        return raw.decode("utf-8", "replace")
    raise SystemExit("No usable events iframe snapshot")


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


def parse_events_html(html: str) -> dict[str, dict[str, str | None]]:
    quarters: dict[str, dict[str, str | None]] = {}
    # Split on earnings conference call sections
    chunks = re.split(
        r'<div class="field__item">CME Group Inc\.[^<]*(?:First|Second|Third|Fourth)[^<]*(?:20\d{2})[^<]*Earnings Conference Call</div>',
        html,
        flags=re.I,
    )
    headers = re.findall(
        r'<div class="field__item">(CME Group Inc\.[^<]*(?:First|Second|Third|Fourth)[^<]*(?:20\d{2})[^<]*Earnings Conference Call)</div>',
        html,
        flags=re.I,
    )
    for header, chunk in zip(headers, chunks[1:]):
        qm = re.search(
            r"(First|Second|Third|Fourth)[-\s]Quarter(?: and Year-End)?\s+(20\d{2})",
            header,
            re.I,
        )
        if not qm:
            continue
        qmap = {"first": 1, "second": 2, "third": 3, "fourth": 4}
        qk = f"Q{qmap[qm.group(1).lower()]} {qm.group(2)}"
        if int(qm.group(2)) < 2022:
            continue
        slides = filings = None
        for m in re.finditer(
            r'href="(/static-files/[a-f0-9-]+)"[^>]*>([^<]+)</a>',
            chunk,
            re.I,
        ):
            href, label = m.group(1), m.group(2).strip().lower()
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
    if not url or "PLACEHOLDER" in url:
        return False
    # Direct first (often blocked); fall back to wayback id_
    for attempt_url in (
        url,
        f"https://web.archive.org/web/20251201000000id_/{url}",
    ):
        req = urllib.request.Request(
            attempt_url, headers={"User-Agent": UA, "Range": "bytes=0-4"}
        )
        try:
            with urllib.request.urlopen(req, context=CTX, timeout=35) as r:
                if r.read(5).startswith(b"%PDF"):
                    return True
        except Exception:
            continue
    cmd = [
        "curl",
        "-sL",
        "--max-time",
        "25",
        "-A",
        UA,
        "-H",
        "Range: bytes=0-4",
        url,
    ]
    try:
        data = subprocess.check_output(cmd)
        return data.startswith(b"%PDF")
    except Exception:
        return False


def quarter_color(entry: dict) -> str:
    s, f = entry.get("slides"), entry.get("filings")
    if s and f and s != f:
        return "green"
    if s or f:
        return "yellow"
    return "red"


def verify_catalog(quarters: dict) -> dict:
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
                print(f"BAD PDF: {u}")
            time.sleep(0.05)
    return {
        "method": "Range-GET bytes=0-4",
        "ok": ok,
        "bad": bad,
        "quarterCounts": {"green": g, "yellow": y, "red": r},
    }


def ticker_light(verified: dict) -> str:
    qc = verified["quarterCounts"]
    if verified["bad"]:
        return "yellow"
    if qc["red"] == 0 and qc["yellow"] == 0 and qc["green"] > 0:
        return "green"
    if qc["green"] == 0 and qc["yellow"] == 0:
        return "red"
    return "yellow"


def merge_manual(parsed: dict) -> dict:
    for qk, slot in MANUAL.items():
        parsed.setdefault(qk, {"slides": None, "filings": None})
        for kind in ("slides", "filings"):
            v = slot.get(kind)
            if v and "PLACEHOLDER" not in v:
                parsed[qk][kind] = v
    return parsed


def main() -> None:
    html = fetch_iframe_html()
    parsed = parse_events_html(html)
    parsed = merge_manual(parsed)

    scope = quarter_keys_through(2026, 2)
    quarters: dict[str, dict[str, str | None]] = {}
    for qk in scope:
        quarters[qk] = parsed.get(qk, {"slides": None, "filings": None})

    verified = verify_catalog(quarters)
    light = ticker_light(verified)
    hosts = sorted(
        {
            u.split("/")[2]
            for q in quarters.values()
            for u in (q.get("slides"), q.get("filings"))
            if u
        }
    )
    cat = {
        "ticker": "CME",
        "fyEnd": "12-31",
        "irPages": [
            "https://investor.cmegroup.com",
            "https://investor.cmegroup.com/events-and-presentations",
            "https://investor.cmegroup.com/events-and-presentations-iframe",
            "https://www.cmegroup.com/investor-relations/financial-information.html",
            "https://cmegroupinc.gcs-web.com/news-releases",
        ],
        "pdfHost": hosts[0] if len(hosts) == 1 else ", ".join(hosts),
        "trafficLight": light,
        "notes": (
            "CME Group calendar FY. Drupal IR on investor.cmegroup.com/static-files: "
            "Slides=Quarterly Earnings Commentary; Filings=Earnings Press Release "
            "(events iframe per earnings call). Never SEC HTML / intro scripts / income trends. "
            f"Scope Q1 2022→Q2 2026. Counts green={verified['quarterCounts']['green']} "
            f"yellow={verified['quarterCounts']['yellow']} red={verified['quarterCounts']['red']}. "
            f"Range-GET ok/bad={verified['ok']}/{verified['bad']}. "
            "Blocker: cmegroup.com blocks automated fetch; catalog from wayback iframe + known UUIDs."
        ),
        "quarters": quarters,
        "verified": verified,
    }
    OUT.write_text(json.dumps(cat, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUT} light={light} g/y/r={verified['quarterCounts']}")


if __name__ == "__main__":
    main()
