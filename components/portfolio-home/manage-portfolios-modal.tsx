"use client";

import { useId, useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";
import { Reorder, useDragControls } from "motion/react";

import { PortfolioListLogo } from "@/components/portfolio/portfolio-brokerage-logo";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import { portfolioKindSubtext, type PortfolioEntry } from "@/components/portfolio/portfolio-types";
import {
  DEFAULT_TABLE_ROW_HOVER_PAD_CLASS,
  SCREENER_TABLE_DATA_ROW_CLASS,
  SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
  SCREENER_TABLE_STROKE_INSET_CLASS,
  TABLE_END_ALIGNED_PAD_CLASS,
  TABLE_START_ALIGNED_PAD_CLASS,
} from "@/components/screener/screener-table-scroll";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import {
  AppModalFooter,
  AppModalShell,
  appModalCancelButtonClass,
  appModalPrimaryButtonClass,
} from "@/components/ui/app-modal-shell";
import { GripVertical, Pencil, Trash2 } from "@/lib/icons";
import { netCashUsd, normalizeUsdForDisplay, totalNetWorth } from "@/lib/portfolio/overview-metrics";
import { cn } from "@/lib/utils";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const GRID_CLASS = "grid w-full min-w-0 items-center gap-x-2";
/** Inline so the layout never depends on an arbitrary Tailwind class being generated. */
const GRID_STYLE_WIDE: CSSProperties = { gridTemplateColumns: "28px minmax(0,1fr) 140px 80px" };
const GRID_STYLE_NARROW: CSSProperties = { gridTemplateColumns: "28px minmax(0,1fr) 72px" };

const SM_QUERY = "(min-width: 640px)";

function subscribeSm(onChange: () => void) {
  const mql = window.matchMedia(SM_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function useIsSmUp(): boolean {
  return useSyncExternalStore(
    subscribeSm,
    () => window.matchMedia(SM_QUERY).matches,
    () => true,
  );
}

const ICON_BUTTON_CLASS =
  "inline-flex size-8 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15 dark:hover:bg-dropdown-item-hover";

function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

function ManagePortfolioRow({
  portfolio,
  valueUsd,
  index,
  count,
  showValue,
  onMove,
  onEdit,
  onDelete,
}: {
  portfolio: PortfolioEntry;
  valueUsd: number;
  index: number;
  count: number;
  showValue: boolean;
  onMove: (delta: -1 | 1) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      as="div"
      value={portfolio.id}
      dragListener={false}
      dragControls={controls}
      role="row"
      className={SCREENER_TABLE_DATA_ROW_CLASS}
      whileDrag={{
        zIndex: 1,
        boxShadow: "0 8px 20px -6px rgba(var(--fs-shadow-rgb), var(--fs-shadow-a-12))",
      }}
    >
      <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
        <div
          className={cn(GRID_CLASS, "min-h-[56px] text-[14px] font-normal leading-5", SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS)}
          style={showValue ? GRID_STYLE_WIDE : GRID_STYLE_NARROW}
        >
          <div role="cell" className={cn("relative z-[1] flex", TABLE_START_ALIGNED_PAD_CLASS)}>
            <button
              type="button"
              aria-label={`Reorder ${portfolio.name}. Use arrow keys to move.`}
              onPointerDown={(e) => controls.start(e)}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp" && index > 0) {
                  e.preventDefault();
                  onMove(-1);
                } else if (e.key === "ArrowDown" && index < count - 1) {
                  e.preventDefault();
                  onMove(1);
                }
              }}
              className="-ml-1.5 inline-flex size-7 cursor-grab touch-none items-center justify-center rounded-md text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15 active:cursor-grabbing"
            >
              <GripVertical className="size-4" strokeWidth={2} aria-hidden />
            </button>
          </div>

          <div role="cell" className="relative z-[1] flex min-w-0 items-center gap-3 pr-2">
            <PortfolioListLogo portfolio={portfolio} size="list" />
            <div className="min-w-0 text-left">
              <div className="truncate text-[14px] font-semibold leading-5 text-fg">{portfolio.name}</div>
              <div className="truncate text-[12px] font-normal leading-4 text-fg-muted">
                {portfolioKindSubtext(portfolio)}
              </div>
            </div>
          </div>

          {showValue ? (
            <div
              role="cell"
              className={cn(
                "relative z-[1] min-w-0 w-full whitespace-nowrap text-right font-['Inter'] font-semibold tabular-nums text-fg",
                TABLE_END_ALIGNED_PAD_CLASS,
              )}
            >
              {usd.format(valueUsd)}
            </div>
          ) : null}

          <div role="cell" className={cn("relative z-[2] flex items-center justify-end gap-0.5", TABLE_END_ALIGNED_PAD_CLASS)}>
            <button type="button" aria-label={`Edit ${portfolio.name}`} onClick={onEdit} className={ICON_BUTTON_CLASS}>
              <Pencil className="size-4" strokeWidth={2} aria-hidden />
            </button>
            <button
              type="button"
              aria-label={`Delete ${portfolio.name}`}
              onClick={onDelete}
              className={cn(ICON_BUTTON_CLASS, "hover:text-down")}
            >
              <Trash2 className="size-4" strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>
      </div>
      {index < count - 1 ? <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden /> : null}
    </Reorder.Item>
  );
}

function ManagePortfoliosDialog({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const showValue = useIsSmUp();
  const {
    portfolios,
    holdingsByPortfolioId,
    transactionsByPortfolioId,
    openEditPortfolio,
    openDeletePortfolio,
    savePortfolioOrder,
  } = usePortfolioWorkspace();

  /** `null` until the user edits — follows the live list so a late cloud sync isn't masked by a stale draft. */
  const [orderDraft, setOrderDraft] = useState<string[] | null>(null);

  /** Draft order over the live list — portfolios deleted or created meanwhile drop out / append. */
  const rows = useMemo(() => {
    const byId = new Map(portfolios.map((p) => [p.id, p]));
    const ids = (orderDraft ?? portfolios.map((p) => p.id)).filter((id) => byId.has(id));
    for (const p of portfolios) if (!ids.includes(p.id)) ids.push(p.id);
    return ids.map((id) => byId.get(id)!);
  }, [orderDraft, portfolios]);
  const rowIds = useMemo(() => rows.map((p) => p.id), [rows]);

  const valueById = useMemo(() => {
    const out = new Map<string, number>();
    for (const p of portfolios) {
      const holdings = holdingsByPortfolioId[p.id] ?? [];
      const txs = transactionsByPortfolioId[p.id] ?? [];
      out.set(p.id, normalizeUsdForDisplay(totalNetWorth(holdings, netCashUsd(txs))));
    }
    return out;
  }, [portfolios, holdingsByPortfolioId, transactionsByPortfolioId]);

  const dirty = !sameOrder(
    rowIds,
    portfolios.map((p) => p.id),
  );

  const move = (id: string, delta: -1 | 1) => {
    const from = rowIds.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= rowIds.length) return;
    const next = [...rowIds];
    [next[from], next[to]] = [next[to]!, next[from]!];
    setOrderDraft(next);
  };

  const save = () => {
    savePortfolioOrder(rowIds);
    onClose();
  };

  return (
    <AppModalShell
      titleId={titleId}
      title="Manage portfolios"
      onClose={onClose}
      maxWidthClass="w-full max-w-2xl"
      bodyClassName="bg-surface pb-2"
      footer={
        <AppModalFooter className="justify-end">
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={onClose} className={appModalCancelButtonClass}>
              Cancel
            </button>
            <button type="button" onClick={save} disabled={!dirty} className={appModalPrimaryButtonClass(dirty)}>
              Save
            </button>
          </div>
        </AppModalFooter>
      }
    >
      <div role="table" aria-labelledby={titleId}>
        <div role="rowgroup" className={SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS}>
          <div role="row" className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
            <div
              className={cn(GRID_CLASS, "min-h-[44px] text-[14px] font-medium leading-5 text-fg-muted")}
              style={showValue ? GRID_STYLE_WIDE : GRID_STYLE_NARROW}
            >
              <div role="columnheader" className={TABLE_START_ALIGNED_PAD_CLASS}>
                <span className="sr-only">Reorder</span>
              </div>
              <div role="columnheader" className="text-left">
                Portfolio
              </div>
              {showValue ? (
                <div role="columnheader" className={cn("min-w-0 w-full text-right", TABLE_END_ALIGNED_PAD_CLASS)}>
                  Value
                </div>
              ) : null}
              <div role="columnheader" className={TABLE_END_ALIGNED_PAD_CLASS}>
                <span className="sr-only">Actions</span>
              </div>
            </div>
          </div>
          <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
        </div>
        <Reorder.Group as="div" axis="y" values={rowIds} onReorder={setOrderDraft} role="rowgroup">
          {rows.map((p, index) => (
            <ManagePortfolioRow
              key={p.id}
              portfolio={p}
              valueUsd={valueById.get(p.id) ?? 0}
              index={index}
              count={rows.length}
              showValue={showValue}
              onMove={(delta) => move(p.id, delta)}
              onEdit={() => openEditPortfolio(p.id)}
              onDelete={() => openDeletePortfolio(p.id)}
            />
          ))}
        </Reorder.Group>
      </div>
    </AppModalShell>
  );
}

/** Home → My portfolios settings: reorder, edit, delete. */
export function ManagePortfoliosModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AppModalOverlay open={open} onClose={onClose}>
      {open ? <ManagePortfoliosDialog onClose={onClose} /> : null}
    </AppModalOverlay>
  );
}
