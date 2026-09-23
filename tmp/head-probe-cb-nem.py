#!/usr/bin/env python3
"""HEAD-probe Chubb presentation + Newmont older-quarter PDF candidates."""
from __future__ import annotations

import concurrent.futures
import urllib.error
import urllib.request

CB = "https://s201.q4cdn.com/471466897/files"
NEM = "https://s24.q4cdn.com/382246808/files"


def check(url: str) -> tuple[int, str]:
    try:
        req = urllib.request.Request(url, method="HEAD")
        with urllib.request.urlopen(req, timeout=15) as resp:
            return int(resp.status), url
    except urllib.error.HTTPError as e:
        return int(e.code), url
    except Exception:
        return 0, url


def cb_cands() -> list[str]:
    out: list[str] = []
    # Q2 2025
    for folder in [
        "doc_presentations/2025/07",
        "doc_presentations/2025/07/22",
        "doc_presentations/2025/07/24",
        "doc_downloads/2025/07",
        "doc_financials/2025/q2",
        "doc_financials/2025/q2/v2",
    ]:
        for name in [
            "Final-Q2-2025-Corporate-Presentation.pdf",
            "Final-Q2-2025-Corporate-Presentation-7-22-25.pdf",
            "Final-Q2-2025-Corporate-Presentation-7-24-25.pdf",
            "Final-Chubb-2nd-Quarter-2025-Corporate-Presentation.pdf",
            "Final-Chubb-2nd-Quarter-2025-Corporate-Presentation-7-22-25.pdf",
            "Final-Chubb-2nd-Quarter-2025-Corporate-Presentation-7-24-25.pdf",
            "Chubb-Second-Quarter-2025-Corporate-Presentation-Final.pdf",
            "chubb-second-quarter-2025-corporate-presentation.pdf",
            "Final-Chubb-Second-Quarter-2025-Corporate-Presentation.pdf",
        ]:
            out.append(f"{CB}/{folder}/{name}")

    # Q1 2024
    for folder in [
        "doc_presentations/2024/04",
        "doc_presentations/2024/05",
        "doc_presentations/2024/04/23",
        "doc_downloads/2024/04",
        "doc_downloads/2024/05",
        "doc_financials/2024/q1",
        "doc_financials/2024/q1/v2",
    ]:
        for name in [
            "Chubb-First-Quarter-2024-Corporate-Presentation-Final.pdf",
            "Final-Chubb-1st-Quarter-2024-Corporate-Presentation.pdf",
            "Final-Chubb-1st-Quarter-2024-Corporate-Presentation-4-23-24.pdf",
            "Final-Q1-2024-Corporate-Presentation.pdf",
            "chubb-first-quarter-2024-corporate-presentation.pdf",
            "1st-Quarter-2024-Corporate-Presentation.pdf",
        ]:
            out.append(f"{CB}/{folder}/{name}")

    # 2022–2023 corporate decks
    specs = [
        (
            ["doc_presentations/2024/02", "doc_presentations/2024/01", "doc_downloads/2024/02", "doc_downloads/2024/01", "doc_financials/2023/q4"],
            [
                "Chubb-Fourth-Quarter-2023-Corporate-Presentation-Final.pdf",
                "Final-Q4-2023-Corporate-Presentation.pdf",
                "Final-Chubb-4th-Quarter-2023-Corporate-Presentation.pdf",
                "chubb-fourth-quarter-2023-corporate-presentation.pdf",
                "Final-Q4-2023-Corporate-Presentation-2-1-24.pdf",
            ],
        ),
        (
            ["doc_presentations/2023/10", "doc_downloads/2023/10", "doc_financials/2023/q3"],
            [
                "Chubb-Third-Quarter-2023-Corporate-Presentation-Final.pdf",
                "Final-Chubb-3rd-Quarter-2023-Corporate-Presentation.pdf",
                "chubb-third-quarter-2023-corporate-presentation.pdf",
            ],
        ),
        (
            ["doc_presentations/2023/07", "doc_downloads/2023/07", "doc_financials/2023/q2"],
            [
                "Chubb-Second-Quarter-2023-Corporate-Presentation-Final.pdf",
                "Final-Chubb-2nd-Quarter-2023-Corporate-Presentation.pdf",
                "chubb-second-quarter-2023-corporate-presentation.pdf",
            ],
        ),
        (
            ["doc_presentations/2023/04", "doc_downloads/2023/04", "doc_financials/2023/q1"],
            [
                "Chubb-First-Quarter-2023-Corporate-Presentation-Final.pdf",
                "Final-Chubb-1st-Quarter-2023-Corporate-Presentation.pdf",
                "chubb-first-quarter-2023-corporate-presentation.pdf",
            ],
        ),
        (
            ["doc_presentations/2023/02", "doc_presentations/2023/01", "doc_downloads/2023/02", "doc_downloads/2023/01", "doc_financials/2022/q4"],
            [
                "Chubb-Fourth-Quarter-2022-Corporate-Presentation-Final.pdf",
                "Final-Q4-2022-Corporate-Presentation.pdf",
                "chubb-fourth-quarter-2022-corporate-presentation.pdf",
            ],
        ),
        (
            ["doc_presentations/2022/10", "doc_downloads/2022/10", "doc_financials/2022/q3"],
            [
                "Chubb-Third-Quarter-2022-Corporate-Presentation-Final.pdf",
                "chubb-third-quarter-2022-corporate-presentation.pdf",
            ],
        ),
        (
            ["doc_presentations/2022/07", "doc_downloads/2022/07", "doc_financials/2022/q2"],
            [
                "Chubb-Second-Quarter-2022-Corporate-Presentation-Final.pdf",
                "chubb-second-quarter-2022-corporate-presentation.pdf",
            ],
        ),
        (
            ["doc_presentations/2022/04", "doc_downloads/2022/04", "doc_financials/2022/q1"],
            [
                "Chubb-First-Quarter-2022-Corporate-Presentation-Final.pdf",
                "chubb-first-quarter-2022-corporate-presentation.pdf",
            ],
        ),
    ]
    for folders, names in specs:
        for folder in folders:
            for name in names:
                out.append(f"{CB}/{folder}/{name}")
    return out


def nem_cands() -> list[str]:
    out: list[str] = []
    # Q1 2023 + all 2022 — alternate path styles
    quarters = [
        ("2023", 1),
        ("2022", 1),
        ("2022", 2),
        ("2022", 3),
        ("2022", 4),
    ]
    for y, q in quarters:
        for folder in [
            f"doc_earnings/{y}/q{q}/presentation",
            f"doc_earnings/{y}/q{q}",
            f"doc_presentations/{y}",
            f"doc_financials/{y}/q{q}",
            f"doc_downloads/{y}",
        ]:
            for name in [
                f"Newmont-Q{q}-{y}-Earnings-Presentation_Final.pdf",
                f"Newmont-Q{q}-{y}-Earnings-Presentation.pdf",
                f"Newmont_Q{q}_{y}_Earnings_Presentation.pdf",
                f"Q{q}-{y}-Earnings-Presentation.pdf",
                f"Newmont-Q{q}{y}-Results-Presentation.pdf",
                f"Newmont-{y}-Q{q}-Earnings-Presentation.pdf",
            ]:
                out.append(f"{NEM}/{folder}/{name}")
        for folder in [
            f"doc_earnings/{y}/q{q}/earnings-result",
            f"doc_earnings/{y}/q{q}",
            f"doc_financials/{y}/q{q}",
            f"doc_news/{y}",
            f"doc_downloads/{y}",
        ]:
            for name in [
                f"Newmont-Q{q}-{y}-Earnings-Release_Final.pdf",
                f"Newmont-Q{q}-{y}-Earnings-Release.pdf",
                f"Newmont_Q{q}_{y}_Earnings_Release.pdf",
                f"Newmont-Q{q}-{y}-Earnings-and-202{int(y[3])+1}-Guidance-Release-FINAL.pdf",
            ]:
                out.append(f"{NEM}/{folder}/{name}")
    # event-dated paths often used historically
    event_guesses = [
        "doc_events/2023/Apr/27/Newmont-Q1-2023-Earnings-Presentation_Final.pdf",
        "doc_events/2023/Apr/Newmont-Q1-2023-Earnings-Presentation_Final.pdf",
        "doc_events/2023/04/Newmont-Q1-2023-Earnings-Presentation_Final.pdf",
        "doc_events/2022/Apr/Newmont-Q1-2022-Earnings-Presentation_Final.pdf",
        "doc_events/2022/Jul/Newmont-Q2-2022-Earnings-Presentation_Final.pdf",
        "doc_events/2022/Oct/Newmont-Q3-2022-Earnings-Presentation_Final.pdf",
        "doc_events/2023/Feb/Newmont-Q4-2022-Earnings-Presentation_Final.pdf",
        "doc_events/2023/Apr/27/Newmont-Q1-2023-Earnings-Release_Final.pdf",
        "doc_events/2022/Apr/Newmont-Q1-2022-Earnings-Release_Final.pdf",
        "doc_events/2022/Jul/Newmont-Q2-2022-Earnings-Release_Final.pdf",
        "doc_events/2022/Oct/Newmont-Q3-2022-Earnings-Release_Final.pdf",
        "doc_events/2023/Feb/Newmont-Q4-2022-Earnings-Release_Final.pdf",
    ]
    out.extend(f"{NEM}/{p}" for p in event_guesses)
    return out


def main() -> None:
    for label, urls in [("CB", cb_cands()), ("NEM", nem_cands())]:
        print(f"=== {label} tried={len(urls)} ===")
        hits: list[str] = []
        with concurrent.futures.ThreadPoolExecutor(32) as ex:
            for code, url in ex.map(check, urls):
                if code == 200:
                    hits.append(url)
        print(f"hits={len(hits)}")
        for u in hits:
            print(u)


if __name__ == "__main__":
    main()
