"use client";

import Link from "next/link";

import {
  AgentAllocationList,
  AgentHoldingList,
  AgentTickerChipRow,
  parseAgentAllocationLine,
  parseAgentHoldingLine,
  parseAgentTickerToken,
  type AgentHoldingRef,
  type AgentTickerRef,
} from "@/components/agents/agent-ticker-chip";
import { ChevronRight } from "@/lib/icons";
import { cn } from "@/lib/utils";

type Block =
  | { type: "heading"; text: string }
  | { type: "list"; items: string[] }
  | { type: "tickers"; tickers: AgentTickerRef[] }
  | { type: "holdings"; holdings: AgentHoldingRef[] }
  | {
      type: "allocation";
      rows: Array<{
        ticker: AgentTickerRef;
        weightLabel: string;
        worthLabel: string | null;
      }>;
    }
  | { type: "paragraph"; text: string };

const HEADING_RE = /^(?:\*\*(.+?)\*\*|#{1,3}\s+(.+))\s*:?\s*$/;
const BULLET_RE = /^[-*•]\s+(.+)$/;
const NUMBERED_ITEM_RE = /^\d+\.\s+(.+)$/;
const INLINE_TICKERS_RE =
  /^(Notable stocks|Notable holdings|Tickers|Symbols|Holdings)\s*:\s*(.+)$/i;
/** Plain portfolio / collection titles the model often emits without markdown. */
const PLAIN_SECTION_RE = /^[A-Za-z0-9][A-Za-z0-9 &'().:\-]{0,60}$/;

const APP_PATH_SPLIT_RE =
  /(\*\*[^*]+\*\*|\/(?:watchlist|portfolio|portfolios|news|screener|earnings|macro|agents|heatmap|heatmaps|economy|crypto|stock|charting|comparison|superinvestors|account)(?:\/[A-Za-z0-9._~%+-]*)*)/g;

const APP_PATH_TEST_RE =
  /^\/(?:watchlist|portfolio|portfolios|news|screener|earnings|macro|agents|heatmap|heatmaps|economy|crypto|stock|charting|comparison|superinvestors|account)(?:\/[A-Za-z0-9._~%+-]*)*$/;

const APP_PATH_LABELS: Record<string, string> = {
  "/watchlist": "Watchlist",
  "/portfolio": "Portfolio",
  "/portfolios": "Portfolios",
  "/news": "News",
  "/screener": "Screener",
  "/earnings": "Earnings",
  "/macro": "Macro",
  "/agents": "Agent",
  "/heatmap": "Heatmaps",
  "/heatmaps": "Heatmaps",
  "/economy": "Economy",
  "/charting": "Charting",
  "/comparison": "Comparison",
  "/superinvestors": "Superinvestors",
  "/account": "Account",
};

function stripMdBold(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").trim();
}

function cleanSectionHeading(raw: string): string {
  let t = stripMdBold(raw).replace(/:$/, "").trim();
  t = t.replace(/^Portfolio\s*:\s*/i, "");
  t = t.replace(/\s*[-–—]\s*Holdings\s*$/i, "");
  t = t.replace(/\s+Holdings\s*$/i, "");
  return t.trim() || "Holdings";
}

function parseTickerList(raw: string): AgentTickerRef[] {
  const parts = raw.split(/[,|]/).map((p) => p.trim()).filter(Boolean);
  const out: AgentTickerRef[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const t = parseAgentTickerToken(part);
    if (!t) continue;
    const key = `${t.kind}:${t.symbol}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function isHoldingOrTickerBullet(line: string): boolean {
  const body = line.replace(/^[-*•]\s+/, "").trim();
  return Boolean(
    parseAgentHoldingLine(body) ||
      parseAgentAllocationLine(body) ||
      parseAgentTickerToken(body),
  );
}

/** Portfolio / section title mistyped as a bullet — promote to heading. */
function bulletBodyAsSectionHeading(body: string): string | null {
  const boldTitle = body.match(/^\*\*(.+?)\*\*(?:\s+(\([^)]*\)))?\s*$/);
  if (boldTitle) {
    const name = cleanSectionHeading(boldTitle[1] ?? "");
    const suffix = (boldTitle[2] ?? "").trim();
    return suffix ? `${name} ${suffix}` : name;
  }
  return null;
}

function parseAgentBlocks(content: string): Block[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let listBuf: string[] = [];
  let tickerBuf: AgentTickerRef[] = [];
  let holdingBuf: AgentHoldingRef[] = [];
  let allocationBuf: Array<{
    ticker: AgentTickerRef;
    weightLabel: string;
    worthLabel: string | null;
  }> = [];

  const flushPara = () => {
    if (para.length === 0) return;
    const text = para.join("\n").trim();
    para = [];
    if (text) blocks.push({ type: "paragraph", text });
  };

  const flushList = () => {
    if (listBuf.length === 0) return;
    blocks.push({ type: "list", items: listBuf });
    listBuf = [];
  };

  const flushTickers = () => {
    if (tickerBuf.length === 0) return;
    blocks.push({ type: "tickers", tickers: tickerBuf });
    tickerBuf = [];
  };

  const flushHoldings = () => {
    if (holdingBuf.length === 0) return;
    blocks.push({ type: "holdings", holdings: holdingBuf });
    holdingBuf = [];
  };

  const flushAllocation = () => {
    if (allocationBuf.length === 0) return;
    blocks.push({ type: "allocation", rows: allocationBuf });
    allocationBuf = [];
  };

  const flushLists = () => {
    flushList();
    flushTickers();
    flushHoldings();
    flushAllocation();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushLists();
      flushPara();
      continue;
    }

    const heading = trimmed.match(HEADING_RE);
    if (heading) {
      flushLists();
      flushPara();
      blocks.push({ type: "heading", text: cleanSectionHeading(heading[1] ?? heading[2] ?? "") });
      continue;
    }

    const boldTitle = trimmed.match(/^\*\*(.+?)\*\*(?:\s+(\([^)]*\)))?\s*$/);
    if (boldTitle) {
      flushLists();
      flushPara();
      const name = cleanSectionHeading(boldTitle[1] ?? "");
      const suffix = (boldTitle[2] ?? "").trim();
      blocks.push({ type: "heading", text: suffix ? `${name} ${suffix}` : name });
      continue;
    }

    const numberedHeading = trimmed.match(/^\d+\.\s+\*\*(.+?)\*\*\s*$/);
    if (numberedHeading) {
      flushLists();
      flushPara();
      blocks.push({ type: "heading", text: cleanSectionHeading(numberedHeading[1] ?? "") });
      continue;
    }

    if (
      !trimmed.startsWith("-") &&
      !trimmed.startsWith("*") &&
      !trimmed.startsWith("•") &&
      !/^\d+\.\s/.test(trimmed) &&
      PLAIN_SECTION_RE.test(trimmed) &&
      trimmed.length <= 60
    ) {
      let j = i + 1;
      while (j < lines.length && !lines[j]!.trim()) j++;
      const next = lines[j]?.trim() ?? "";
      if (
        next &&
        (BULLET_RE.test(next) || NUMBERED_ITEM_RE.test(next) || isHoldingOrTickerBullet(next))
      ) {
        flushLists();
        flushPara();
        blocks.push({ type: "heading", text: cleanSectionHeading(trimmed) });
        continue;
      }
    }

    const bullet = trimmed.match(BULLET_RE);
    if (bullet) {
      const body = (bullet[1] ?? "").trim();
      // "- Best performance:" → section heading above a holdings table card
      if (/^.+:\s*$/.test(body) && !isHoldingOrTickerBullet(body)) {
        flushLists();
        flushPara();
        blocks.push({ type: "heading", text: cleanSectionHeading(body) });
        continue;
      }
      // "- **R1 Fund** (currently selected)" mistyped as a list item → title
      const promoted = bulletBodyAsSectionHeading(body);
      if (promoted) {
        flushLists();
        flushPara();
        blocks.push({ type: "heading", text: promoted });
        continue;
      }
      const inlineInBullet = body.match(INLINE_TICKERS_RE);
      if (inlineInBullet) {
        const list = parseTickerList(inlineInBullet[2] ?? "");
        if (list.length > 0) {
          flushPara();
          flushLists();
          blocks.push({
            type: "heading",
            text: stripMdBold(inlineInBullet[1] ?? "Tickers"),
          });
          blocks.push({ type: "tickers", tickers: list });
          continue;
        }
      }
      const holding = parseAgentHoldingLine(body);
      if (holding) {
        flushPara();
        flushList();
        flushTickers();
        flushAllocation();
        holdingBuf.push(holding);
        continue;
      }
      const alloc = parseAgentAllocationLine(body);
      if (alloc) {
        flushPara();
        flushList();
        flushTickers();
        flushHoldings();
        allocationBuf.push(alloc);
        continue;
      }
      const t = parseAgentTickerToken(body);
      if (t) {
        flushPara();
        flushList();
        flushHoldings();
        flushAllocation();
        tickerBuf.push(t);
        continue;
      }
      flushPara();
      flushTickers();
      flushHoldings();
      flushAllocation();
      listBuf.push(body);
      continue;
    }

    const numberedItem = trimmed.match(NUMBERED_ITEM_RE);
    if (numberedItem && !/^\d+\.\s+\*\*(.+?)\*\*\s*$/.test(trimmed)) {
      const body = (numberedItem[1] ?? "").trim();
      if (body && !isHoldingOrTickerBullet(body)) {
        flushPara();
        flushTickers();
        flushHoldings();
        flushAllocation();
        listBuf.push(body);
        continue;
      }
    }

    const inline = trimmed.match(INLINE_TICKERS_RE);
    if (inline) {
      const list = parseTickerList(inline[2] ?? "");
      if (list.length > 0) {
        flushLists();
        flushPara();
        blocks.push({ type: "heading", text: stripMdBold(inline[1] ?? "Tickers") });
        blocks.push({ type: "tickers", tickers: list });
        continue;
      }
    }

    flushLists();
    para.push(trimmed);
  }

  flushLists();
  flushPara();
  return blocks;
}

function AgentAppPathLink({
  path,
  label: labelProp,
}: {
  path: string;
  label?: string;
}) {
  const clean = path.replace(/[.,;:!?)]+$/, "");
  const trailing = path.slice(clean.length);
  const rawLabel = (labelProp ?? APP_PATH_LABELS[clean] ?? clean).trim();
  const label = rawLabel.replace(/^\[|\]$/g, "").trim() || APP_PATH_LABELS[clean] || clean;

  return (
    <>
      <Link
        prefetch={false}
        href={clean}
        className="group inline-flex items-center gap-0.5 font-semibold text-[#141414] no-underline underline-offset-2 decoration-[#5C5D5F] hover:underline"
      >
        <span>{label.charAt(0).toUpperCase() + label.slice(1)}</span>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-[#A1A1AA] transition-colors group-hover:text-[#5C5D5F]"
          strokeWidth={2}
          aria-hidden
        />
      </Link>
      {trailing}
    </>
  );
}

function extractAppPath(href: string): string | null {
  const cleaned = href.trim().replace(/^sandbox:/i, "");
  if (APP_PATH_TEST_RE.test(cleaned)) return cleaned;
  const m = cleaned.match(
    /(\/(?:watchlist|portfolio|portfolios|news|screener|earnings|macro|agents|heatmap|heatmaps|economy|crypto|stock|charting|comparison|superinvestors|account)(?:\/[A-Za-z0-9._~%+-]*)*)/,
  );
  return m?.[1] ?? null;
}

function renderTextChunk(text: string, keyPrefix: string) {
  const parts = text.split(APP_PATH_SPLIT_RE);
  return parts.map((part, i) => {
    if (!part) return null;
    const bold = part.match(/^\*\*(.+)\*\*$/);
    if (bold) {
      return (
        <strong key={`${keyPrefix}-b-${i}`} className="font-semibold">
          {bold[1]}
        </strong>
      );
    }
    if (APP_PATH_TEST_RE.test(part)) {
      return <AgentAppPathLink key={`${keyPrefix}-p-${i}`} path={part} />;
    }
    return <span key={`${keyPrefix}-t-${i}`}>{part}</span>;
  });
}

function renderInline(text: string) {
  const nodes: React.ReactNode[] = [];
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = linkRe.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(...renderTextChunk(text.slice(last, match.index), `c${idx}`));
    }
    const label = stripMdBold(match[1] ?? "");
    const path = extractAppPath(match[2] ?? "");
    if (path) {
      nodes.push(<AgentAppPathLink key={`md-${idx}`} path={path} label={label} />);
    } else {
      nodes.push(<span key={`md-${idx}`}>{label || match[0]}</span>);
    }
    last = match.index + match[0].length;
    idx += 1;
  }

  if (last < text.length) {
    nodes.push(...renderTextChunk(text.slice(last), `c${idx}`));
  }

  return nodes;
}

export function AgentMessageContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const blocks = parseAgentBlocks(content);
  const hasRich = blocks.some(
    (b) =>
      b.type === "tickers" ||
      b.type === "holdings" ||
      b.type === "allocation" ||
      b.type === "heading" ||
      b.type === "list",
  );

  if (!hasRich) {
    return (
      <div className={cn("whitespace-pre-wrap font-normal text-[16px] leading-6 text-[#141414]", className)}>
        {renderInline(content)}
      </div>
    );
  }

  return (
    <div className={cn("flex w-full max-w-xl flex-col gap-3 font-normal text-[16px] leading-6 text-[#141414]", className)}>
      {blocks.map((b, i) => {
        if (b.type === "heading") {
          return (
            <h3
              key={`h-${i}`}
              className={cn(
                "text-[18px] font-semibold leading-7 tracking-tight text-[#141414]",
                i > 0 && "mt-1",
              )}
            >
              {b.text}
            </h3>
          );
        }
        if (b.type === "list") {
          return (
            <ul
              key={`l-${i}`}
              className="m-0 list-disc space-y-1.5 pl-5 marker:text-[#A1A1AA]"
            >
              {b.items.map((item, j) => (
                <li key={`li-${i}-${j}`} className="pl-0.5 leading-6 text-[#141414]">
                  {renderInline(item)}
                </li>
              ))}
            </ul>
          );
        }
        if (b.type === "tickers") {
          return <AgentTickerChipRow key={`t-${i}`} tickers={b.tickers} />;
        }
        if (b.type === "holdings") {
          return <AgentHoldingList key={`hold-${i}`} holdings={b.holdings} />;
        }
        if (b.type === "allocation") {
          return <AgentAllocationList key={`alloc-${i}`} rows={b.rows} />;
        }
        return (
          <p key={`p-${i}`} className="whitespace-pre-wrap">
            {renderInline(b.text)}
          </p>
        );
      })}
    </div>
  );
}
