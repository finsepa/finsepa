#!/usr/bin/env python3
import json
import re
import urllib.request
from pathlib import Path

out_dir = Path(__file__).resolve().parent
catalog = {}
for y in range(2022, 2027):
    url = (
        "https://www.generali.com/en/site-generali/media/press-releases/all/"
        f"platform/content/0?year={y}&ajax=true"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    html = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "ignore")
    (out_dir / f"arzgy-pr-all-{y}.html").write_text(html)
    hrefs = re.findall(r'href="(/doc/jcr:[^"]*Consolidated[^"]*)"', html)
    titles = re.findall(r"Consolidated Results[^<]{0,100}", html)
    print(f"== {y} size={len(html)} hrefs={len(hrefs)} titles={len(titles)}")
    for t in titles:
        print("  T:", re.sub(r"\s+", " ", t))
    for h in sorted(set(hrefs)):
        print("  H:", h)
    catalog[str(y)] = sorted(set(hrefs))

(out_dir / "arzgy-pr-catalog.json").write_text(json.dumps(catalog, indent=2))
