#!/usr/bin/env python3
"""Find Generali 1Q/9M consolidated results press if any."""
import re
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent
UA = {"User-Agent": "Mozilla/5.0"}


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    return urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "ignore")


for y in range(2022, 2027):
    url = (
        "https://www.generali.com/en/site-generali/media/press-releases/all/"
        f"platform/content/0?year={y}&ajax=true"
    )
    html = fetch(url)
    # Look for 1Q / 9M / third quarter / first quarter results
    hits = []
    for li in re.finditer(r"<li[\s\S]*?</li>", html):
        chunk = li.group(0)
        if not re.search(r"1Q|9M|First Quarter|Third Quarter|9 months|nine months", chunk, re.I):
            continue
        if not re.search(r"Result|Consolidated|Results", chunk, re.I):
            continue
        title = re.search(r"<p class=\"title[^\"]*\">([^<]+)|title=\"([^\"]+)\"|>\s*([^<]*Results[^<]*)<", chunk)
        pdfs = re.findall(r'href="(/doc/jcr:[^"]+\.pdf[^"]*)"', chunk)
        t = None
        if title:
            t = next(g for g in title.groups() if g)
        hits.append((t, pdfs))
    print(f"== {y} q1/9m-ish hits={len(hits)}")
    for t, pdfs in hits[:15]:
        print(" ", t, pdfs[:2])
