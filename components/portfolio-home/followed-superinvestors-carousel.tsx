"use client";

import Link from "next/link";
import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Search, UserRound } from "@/lib/icons";

import { MOBILE_ELEVATED_CARD_CLASS, STOCK_OVERVIEW_SECTION_HEADING_CLASS } from "@/components/design-system/card-surface-styles";
import {
  MAX_CARDS_PER_ROW,
  cardFlex,
  cardsPerRowForWidth,
} from "@/components/portfolio-home/upcoming-earnings-carousel";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { SuperinvestorsEmptyIllustration } from "@/components/portfolio-home/portfolio-empty-illustration";
import { Spinner } from "@/components/ui/spinner";
import { useSuperinvestorFollow } from "@/lib/superinvestors/use-superinvestor-follow";
import { normalizeSuperinvestorFollowHref } from "@/lib/superinvestors/superinvestor-follow-storage";
import { cn } from "@/lib/utils";

type SuperinvestorListRow = {
  href: string;
  displayName: string;
  avatarSrc: string | null;
  filingDate: string | null;
  bookReturnPct1y: number | null;
};

type FollowedCard = {
  href: string;
  displayName: string;
  avatarSrc: string;
  latestUpdateDisplay: string;
  filingDateYmd: string;
  return1yPct: number | null;
  isNew: boolean;
};

/** 13F deadlines bunch filings together; two weeks keeps "New" meaningful. */
const NEW_FILING_DAYS = 14;

/** `Aug 14` in the current year; older filings keep the year. */
function formatLatestUpdate(ymd: string | null): string {
  if (!ymd?.trim()) return "—";
  const d = parseISO(ymd.trim());
  if (!isValid(d)) return "—";
  return format(d, d.getFullYear() === new Date().getFullYear() ? "MMM d" : "MMM d, yyyy");
}

function isRecentFiling(ymd: string | null): boolean {
  if (!ymd?.trim()) return false;
  const d = parseISO(ymd.trim());
  if (!isValid(d)) return false;
  const days = differenceInCalendarDays(new Date(), d);
  return days >= 0 && days <= NEW_FILING_DAYS;
}

function formatSignedPct(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(1)}%`;
}

const TILE_HEIGHT_PX = 160;
const TILE_STYLE = { height: TILE_HEIGHT_PX } as const;
/** Inline so the scrim never depends on generated utility classes; dark in both themes since text sits on the photo. */
const SCRIM_STYLE = {
  backgroundImage: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.85) 100%)",
  textShadow: "0 1px 2px rgba(0,0,0,0.45)",
} as const;
const RETURN_PILL_STYLE = { backgroundColor: "rgba(0,0,0,0.55)", textShadow: "none" } as const;
const NEW_PILL_STYLE = { backgroundColor: "var(--color-accent)" } as const;

function FundCardPhoto({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const trimmed = src.trim();
  if (!trimmed || failed) {
    return (
      <span className="absolute inset-0 flex items-start justify-center bg-surface-muted pt-10 text-fg-muted" aria-hidden>
        <UserRound className="size-8" strokeWidth={1.75} />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- public /superinvestors avatars
    <img
      src={trimmed}
      alt=""
      aria-hidden
      title={name}
      className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      style={{ objectPosition: "center 25%" }}
      onError={() => setFailed(true)}
    />
  );
}

/** Photo tile — name, filing date and 1Y return sit on a bottom scrim (stays dark in both themes). */
function FollowedCardView({ card }: { card: FollowedCard }) {
  const returnLabel = card.return1yPct != null ? `${formatSignedPct(card.return1yPct)} (1Y)` : "";
  return (
    <Link
      href={card.href}
      aria-label={`${card.displayName}, ${card.isNew ? "new filing, " : ""}reported ${card.latestUpdateDisplay}${returnLabel ? `, ${returnLabel}` : ""}`}
      className={cn(
        "group relative block w-full min-w-0 overflow-hidden bg-surface-muted no-underline",
        MOBILE_ELEVATED_CARD_CLASS,
      )}
      style={TILE_STYLE}
    >
      <FundCardPhoto src={card.avatarSrc} name={card.displayName} />
      {card.isNew ? (
        <span
          className="absolute left-2 top-2 rounded-full px-1.5 py-0.5 text-[11px] font-medium leading-3 text-white"
          style={NEW_PILL_STYLE}
        >
          New
        </span>
      ) : null}
      <span className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 px-2 pb-2 pt-10" style={SCRIM_STYLE}>
        <span className="line-clamp-2 text-[13px] font-semibold leading-4 text-white underline-offset-2 group-hover:underline">
          {card.displayName}
        </span>
        <span className="flex min-w-0 items-center justify-between gap-1">
          <span className="truncate text-[11px] font-medium leading-4 text-white" style={{ opacity: 0.85 }}>
            {card.latestUpdateDisplay}
          </span>
          {card.return1yPct != null ? (
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-3 tabular-nums",
                card.return1yPct >= 0 ? "text-up" : "text-down",
              )}
              style={RETURN_PILL_STYLE}
            >
              {formatSignedPct(card.return1yPct)}
            </span>
          ) : null}
        </span>
      </span>
    </Link>
  );
}

function FollowedCardSkeleton() {
  return <div className="w-full min-w-0 animate-pulse rounded-2xl bg-stroke" style={TILE_STYLE} />;
}

/**
 * Followed superinvestors ordered by latest 13F update — same responsive even-count row as earnings.
 */
export function FollowedSuperinvestorsCarousel({ className }: { className?: string }) {
  const { followed, hydrated, loaded, isFollowing } = useSuperinvestorFollow();
  const sectionRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [cardsPerRow, setCardsPerRow] = useState(MAX_CARDS_PER_ROW);
  const [rows, setRows] = useState<SuperinvestorListRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setListLoading(true);
    void fetch("/api/superinvestors", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as { rows?: SuperinvestorListRow[] };
      })
      .then((json) => {
        if (cancelled) return;
        const next = Array.isArray(json?.rows) ? json.rows : [];
        setRows(
          next.map((r) => ({
            href: typeof r.href === "string" ? r.href : "",
            displayName: typeof r.displayName === "string" ? r.displayName : "",
            avatarSrc: typeof r.avatarSrc === "string" ? r.avatarSrc : null,
            filingDate: typeof r.filingDate === "string" ? r.filingDate : null,
            bookReturnPct1y:
              typeof r.bookReturnPct1y === "number" && Number.isFinite(r.bookReturnPct1y) ? r.bookReturnPct1y : null,
          })),
        );
        setListLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setRows([]);
        setListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = useMemo((): FollowedCard[] => {
    if (!hydrated || !loaded) return [];
    const out: FollowedCard[] = [];
    for (const row of rows) {
      const href = normalizeSuperinvestorFollowHref(row.href);
      if (!href || !isFollowing(href)) continue;
      out.push({
        href,
        displayName: row.displayName || href.split("/").pop() || "Superinvestor",
        avatarSrc: row.avatarSrc ?? "",
        latestUpdateDisplay: formatLatestUpdate(row.filingDate),
        filingDateYmd: row.filingDate?.trim() ?? "",
        return1yPct: row.bookReturnPct1y,
        isNew: isRecentFiling(row.filingDate),
      });
    }
    out.sort((a, b) => {
      const da = a.filingDateYmd;
      const db = b.filingDateYmd;
      if (da !== db) {
        if (!da) return 1;
        if (!db) return -1;
        return db.localeCompare(da);
      }
      return a.displayName.localeCompare(b.displayName);
    });
    return out;
  }, [rows, hydrated, loaded, isFollowing, followed]);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const measure = () => setCardsPerRow(cardsPerRowForWidth(el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cardFlexBasis = cardFlex(cardsPerRow);
  const showArrows = canPrev || canNext;

  const updateScrollState = () => {
    const el = scrollerRef.current;
    if (!el) {
      setCanPrev(false);
      setCanNext(false);
      return;
    }
    const max = el.scrollWidth - el.clientWidth;
    setCanPrev(el.scrollLeft > 2);
    setCanNext(max > 2 && el.scrollLeft < max - 2);
  };

  useEffect(() => {
    updateScrollState();
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => updateScrollState();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => updateScrollState());
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [cards.length]);

  const scrollByPage = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: el.clientWidth * 0.9 * dir, behavior: "smooth" });
  };

  const followReady = hydrated && loaded;
  const showSkeleton = listLoading || !followReady;
  const showEmpty = followReady && !listLoading && cards.length === 0;

  return (
    <section ref={sectionRef} className={cn("min-w-0", className)} aria-label="Superinvestor updates">
      <div className="mb-5 flex items-center justify-between gap-2">
        <h2 className={STOCK_OVERVIEW_SECTION_HEADING_CLASS}>Superinvestor updates</h2>
        {showArrows ? (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label="Previous superinvestors"
              disabled={!canPrev}
              onClick={() => scrollByPage(-1)}
              className={cn(
                "inline-flex size-8 items-center justify-center rounded-full transition-colors",
                canPrev
                  ? "text-fg hover:bg-surface-muted"
                  : "cursor-default text-fg-muted/40",
              )}
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Next superinvestors"
              disabled={!canNext}
              onClick={() => scrollByPage(1)}
              className={cn(
                "inline-flex size-8 items-center justify-center rounded-full transition-colors",
                canNext
                  ? "text-fg hover:bg-surface-muted"
                  : "cursor-default text-fg-muted/40",
              )}
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
        ) : null}
      </div>

      {showSkeleton ? (
        <div className="flex w-full min-w-0 gap-3 overflow-hidden">
          {Array.from({ length: cardsPerRow }).map((_, i) => (
            <div key={i} className="min-w-0" style={{ flex: cardFlexBasis }}>
              <FollowedCardSkeleton />
            </div>
          ))}
        </div>
      ) : showEmpty ? (
        <Empty variant="card">
          <EmptyHeader>
            <SuperinvestorsEmptyIllustration className="mb-4" />
            <EmptyTitle>No superinvestors followed</EmptyTitle>
            <EmptyDescription className="max-w-sm">
              Follow superinvestors to see their latest 13F updates here.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="mt-6">
            <Link
              href="/superinvestors"
              className={cn(
                "inline-flex h-10 items-center justify-center gap-1.5 rounded-[10px] border border-transparent bg-fg px-4 text-sm font-semibold text-surface no-underline",
                "fs-primary-button-gradient-stroke shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-12))] transition-opacity hover:opacity-90",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/20 focus-visible:ring-offset-2",
              )}
            >
              <Search className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              Explore
            </Link>
          </EmptyContent>
        </Empty>
      ) : (
        <div
          ref={scrollerRef}
          className="mobile-scroll-x flex w-full min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {cards.map((card) => (
            <div key={card.href} className="min-w-0 snap-start" style={{ flex: cardFlexBasis }}>
              <FollowedCardView card={card} />
            </div>
          ))}
        </div>
      )}

      {listLoading && cards.length > 0 ? (
        <div className="mt-2 flex items-center gap-2 text-[11px] text-fg-muted">
          <Spinner className="size-3 text-[#71717A]" />
          Updating…
        </div>
      ) : null}
    </section>
  );
}
