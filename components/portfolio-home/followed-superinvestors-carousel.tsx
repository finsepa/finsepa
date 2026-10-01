"use client";

import Link from "next/link";
import { format, isValid, parseISO } from "date-fns";
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
};

type FollowedCard = {
  href: string;
  displayName: string;
  avatarSrc: string;
  latestUpdateDisplay: string;
  filingDateYmd: string;
};

function formatLatestUpdate(ymd: string | null): string {
  if (!ymd?.trim()) return "—";
  const d = parseISO(ymd.trim());
  if (!isValid(d)) return "—";
  return format(d, "MMM d, yyyy");
}

const AVATAR_HEIGHT_PX = 104;
const AVATAR_STYLE = { height: AVATAR_HEIGHT_PX } as const;

function FundCardAvatar({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const trimmed = src.trim();
  if (!trimmed || failed) {
    return (
      <span
        className="flex w-full shrink-0 items-center justify-center rounded-[10px] border border-stroke-muted bg-surface-muted text-fg-muted"
        aria-hidden
        style={AVATAR_STYLE}
      >
        <UserRound className="size-7" strokeWidth={1.75} />
      </span>
    );
  }
  return (
    <span className="relative block w-full shrink-0 overflow-hidden rounded-[10px] border border-stroke-muted bg-surface-muted" style={AVATAR_STYLE}>
      {/* eslint-disable-next-line @next/next/no-img-element -- public /superinvestors avatars */}
      <img
        src={trimmed}
        alt={name}
        height={AVATAR_HEIGHT_PX}
        className="h-full w-full object-cover"
        style={{ objectPosition: "center 25%" }}
        onError={() => setFailed(true)}
      />
    </span>
  );
}

function FollowedCardView({ card }: { card: FollowedCard }) {
  return (
    <Link
      href={card.href}
      className={cn(
        "group flex h-full w-full min-w-0 flex-col p-3 no-underline transition-colors",
        MOBILE_ELEVATED_CARD_CLASS,
        "hover:bg-surface-muted/60",
      )}
    >
      <FundCardAvatar src={card.avatarSrc} name={card.displayName} />
      <div className="mt-8 min-w-0 space-y-0.5">
        <p className="truncate text-[13px] font-semibold leading-4 text-fg underline-offset-2 decoration-fg-muted group-hover:underline">
          {card.displayName}
        </p>
        <p className="truncate text-[12px] leading-4 text-fg-muted">{card.latestUpdateDisplay}</p>
      </div>
    </Link>
  );
}

function FollowedCardSkeleton() {
  return (
    <div className={cn("flex w-full min-w-0 flex-col p-3", MOBILE_ELEVATED_CARD_CLASS)}>
      <div className="w-full shrink-0 animate-pulse rounded-[10px] bg-stroke" style={AVATAR_STYLE} />
      <div className="mt-8 space-y-1">
        <div className="h-3.5 w-16 animate-pulse rounded bg-stroke" />
        <div className="h-3 w-16 animate-pulse rounded bg-stroke" />
      </div>
    </div>
  );
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
    <section ref={sectionRef} className={cn("min-w-0", className)} aria-label="Latest superinvestor updates">
      <div className="mb-5 flex items-center justify-between gap-2">
        <h2 className={STOCK_OVERVIEW_SECTION_HEADING_CLASS}>Latest superinvestor updates</h2>
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
