#!/usr/bin/env python3
"""Extract Generali Consolidated Results press PDF URLs by following list items."""
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent
UA = {"User-Agent": "Mozilla/5.0"}


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    return urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "ignore")


def abs_url(href: str) -> str:
    if href.startswith("http"):
        return href
    return urllib.parse.urljoin("https://www.generali.com/", href.lstrip("/"))


results = {}
for y in range(2022, 2027):
    list_url = (
        "https://www.generali.com/en/site-generali/media/press-releases/all/"
        f"platform/content/0?year={y}&ajax=true"
    )
    html = fetch(list_url)
    # Find list items mentioning Consolidated Results and their detail links
    items = []
    for li in re.finditer(r"<li[\s\S]*?</li>", html):
        chunk = li.group(0)
        if "Consolidated Results" not in chunk:
            continue
        title_m = re.search(r"Consolidated Results[^<]*", chunk)
        # prefer PDF href if present
        pdfs = re.findall(r'href="(/doc/jcr:[^"]+\.pdf[^"]*)"', chunk)
        detail = re.findall(r'href="(/media/press-releases/[^"]+|/en/[^"]*press[^"]*)"', chunk)
        # also any relative article links
        links = re.findall(r'href="([^"]+)"', chunk)
        items.append(
            {
                "title": title_m.group(0).strip() if title_m else None,
                "pdfs": pdfs,
                "links": links[:10],
            }
        )
    print(f"== {y} items={len(items)}")
    year_map = {}
    for it in items:
        print(" ", it["title"], "pdfs", it["pdfs"], "links", it["links"][:5])
        pdfs = list(it["pdfs"])
        if not pdfs:
            # follow first non-ajax, non-# link that looks like an article
            for href in it["links"]:
                if "ajax" in href or href.startswith("#") or "platform/content" in href:
                    continue
                if "press" not in href.lower() and "media" not in href.lower():
                    continue
                try:
                    detail_html = fetch(abs_url(href))
                except Exception as e:
                    print("   fetch fail", href, e)
                    continue
                found = re.findall(r'href="(/doc/jcr:[^"]+\.pdf[^"]*)"', detail_html)
                # also absolute generali.com/doc
                found += re.findall(
                    r'href="(https://www\.generali\.com/doc/jcr:[^"]+\.pdf[^"]*)"',
                    detail_html,
                )
                # keep consolidated-looking
                cons = [p for p in found if re.search(r"Consolidated|Results", p, re.I)]
                if cons:
                    pdfs = cons
                    print("   detail", href, "->", cons[:3])
                    break
        if pdfs:
            year_map[it["title"] or "?"] = [abs_url(p) for p in pdfs]
    results[str(y)] = year_map

(OUT / "arzgy-pr-resolved.json").write_text(json.dumps(results, indent=2))
print("wrote", OUT / "arzgy-pr-resolved.json")
