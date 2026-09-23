#!/usr/bin/env python3
"""Verify %PDF on all catalog URLs; spot-check suspicious quarters."""
import json
import ssl
import urllib.request
from pathlib import Path

OUT = Path("/Users/rakshamann/Desktop/Finsepa/tmp/ir-next10")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
CTX = ssl.create_default_context()


def check(url: str) -> tuple[bool, str, int]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Range": "bytes=0-1023"})
    try:
        with urllib.request.urlopen(req, context=CTX, timeout=40) as r:
            data = r.read(8)
            ok = data.startswith(b"%PDF")
            return ok, data[:8].decode("latin1", "replace"), r.status
    except Exception as e:
        return False, str(e)[:80], 0


def main():
    summary = {}
    for name in ("eqix", "caixy", "ing"):
        cat = json.loads((OUT / f"{name}-catalog.json").read_text())
        ticker = cat["ticker"]
        bad = []
        ok_n = bad_n = 0
        print(f"\n=== {ticker} [{cat['trafficLight']}] host={cat['pdfHost']} ===")
        for q, entry in cat["quarters"].items():
            kinds = []
            for kind in ("slides", "filings"):
                u = entry.get(kind)
                if not u:
                    kinds.append(f"{kind}=MISSING")
                    continue
                good, magic, status = check(u)
                if good:
                    ok_n += 1
                    kinds.append(f"{kind}=OK")
                else:
                    bad_n += 1
                    bad.append((q, kind, u, magic, status))
                    kinds.append(f"{kind}=BAD")
            has_s = bool(entry.get("slides"))
            has_f = bool(entry.get("filings"))
            color = (
                "green"
                if has_s and has_f and entry.get("slides") != entry.get("filings")
                else ("yellow" if has_s or has_f else "red")
            )
            print(f"  {color:6} {q}: {', '.join(kinds)}")
        print(f"  verified ok={ok_n} bad={bad_n}")
        for b in bad:
            print(f"  FAIL {b[0]} {b[1]} status={b[4]} magic={b[3]!r}")
            print(f"       {b[2]}")
        summary[ticker] = {"ok": ok_n, "bad": bad_n, "light": cat["trafficLight"], "host": cat["pdfHost"]}

    print("\n=== SUMMARY ===")
    for t, s in summary.items():
        flag = "GREEN" if s["bad"] == 0 and s["light"] == "green" else "CHECK"
        print(f"{flag} {t}: light={s['light']} pdf_ok={s['ok']} pdf_bad={s['bad']} host={s['host']}")


if __name__ == "__main__":
    main()
