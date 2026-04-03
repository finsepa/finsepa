"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { getStockDetailMetaFromTicker } from "@/lib/market/stock-detail-meta";
import type { StockProfilePayload } from "@/lib/market/stock-profile-types";

function dash(v: string | null | undefined): string {
  return v != null && String(v).trim() !== "" ? String(v).trim() : "—";
}

/** Figma Market — Profile: label 12px semibold zinc-500, value 14px regular zinc-950, gap 4px */
function ProfileCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="w-full text-[12px] font-semibold leading-5 text-[#71717A]">{label}</p>
      <div className="min-h-[1.25rem] text-[14px] font-normal leading-5 text-[#09090B]">{children}</div>
    </div>
  );
}

/** Two columns, 36px gap; dashed row dividers (#E4E4E7), py-[10px] */
function ProfileDuoRow({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-9">
      <div className="flex-1 border-b border-dashed border-[#E4E4E7] py-2.5">{left}</div>
      <div className="flex-1 border-b border-dashed border-[#E4E4E7] py-2.5">{right}</div>
    </div>
  );
}

function LinkValue({ url }: { url: string | null }) {
  if (!url?.trim()) return <span>—</span>;
  const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const display = href.replace(/\/$/, "");
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="break-all text-[14px] font-normal text-[#09090B] underline decoration-solid [text-decoration-skip-ink:none] transition-colors hover:text-[#09090B]"
    >
      {display}
    </a>
  );
}

const DESC_COLLAPSE_CHARS = 320;

function ProfileDescription({ text }: { text: string | null }) {
  const [open, setOpen] = useState(false);
  const contentId = useId();

  const needsMore = useMemo(() => {
    if (!text?.trim()) return false;
    if (text.length > DESC_COLLAPSE_CHARS) return true;
    return text.split(/\n/).length > 3;
  }, [text]);

  if (!text?.trim()) {
    return <p className="text-[14px] leading-5 text-[#71717A]">—</p>;
  }

  return (
    <div className="flex flex-col gap-2 text-left">
      <div
        className={`overflow-hidden transition-[max-height] duration-300 ease-out ${
          open ? "max-h-[min(4800px,90vh)]" : "max-h-[4.65rem]"
        }`}
        id={contentId}
      >
        <p className="w-full whitespace-pre-wrap text-[14px] font-normal leading-5 text-[#09090B]">{text}</p>
      </div>
      {needsMore ? (
        <button
          type="button"
          className="w-full text-left text-[14px] font-normal text-[#09090B] underline decoration-solid [text-decoration-skip-ink:none] transition-opacity hover:opacity-80"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={contentId}
        >
          {open ? "Less" : "More..."}
        </button>
      ) : null}
    </div>
  );
}

export function StockProfileTab({ ticker, initialProfile }: { ticker: string; initialProfile?: StockProfilePayload | null }) {
  const [loading, setLoading] = useState(initialProfile === undefined);
  const [profile, setProfile] = useState<StockProfilePayload | null>(initialProfile ?? null);

  const meta = useMemo(() => getStockDetailMetaFromTicker(ticker), [ticker]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (initialProfile !== undefined) {
        setProfile(initialProfile ?? null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/stocks/${encodeURIComponent(ticker)}/profile`, {
          credentials: "include",
        });
        if (!res.ok) {
          if (!cancelled) setProfile(null);
          return;
        }
        const json = (await res.json()) as { profile?: StockProfilePayload | null };
        if (!cancelled) setProfile(json.profile ?? null);
      } catch {
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [ticker, initialProfile]);

  const p = profile;

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 pt-1">
      {loading ? (
        <>
          <div className="flex justify-start" aria-hidden>
            <div className="h-[61px] w-full max-w-[250px] rounded-lg bg-neutral-200/90" />
          </div>
          <div className="w-full space-y-2" aria-hidden>
            <div className="h-4 w-full rounded bg-neutral-200/90" />
            <div className="h-4 w-full rounded bg-neutral-200/90" />
            <div className="h-4 w-2/3 rounded bg-neutral-200/90" />
          </div>
          <div className="w-full space-y-0" aria-hidden>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex flex-col gap-0 sm:flex-row sm:gap-9">
                <div className="flex-1 border-b border-dashed border-[#E4E4E7] py-2.5">
                  <div className="h-3 w-16 rounded bg-neutral-200/80" />
                  <div className="mt-2 h-4 w-3/4 max-w-xs rounded bg-neutral-100" />
                </div>
                <div className="flex-1 border-b border-dashed border-[#E4E4E7] py-2.5">
                  <div className="h-3 w-20 rounded bg-neutral-200/80" />
                  <div className="mt-2 h-4 w-2/3 max-w-xs rounded bg-neutral-100" />
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex justify-start">
            <div className="flex h-[61px] max-w-[250px] items-center justify-start">
              {meta.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote favicon
                <img
                  src={meta.logoUrl}
                  alt=""
                  className="max-h-[61px] w-auto max-w-full object-contain object-left"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <span className="text-[28px] font-bold tracking-tight text-[#09090B]">{ticker}</span>
              )}
            </div>
          </div>

          <div className="w-full min-w-0">
            <ProfileDescription text={p?.description ?? null} />
          </div>

          <div className="flex w-full min-w-0 flex-col gap-0">
            <ProfileDuoRow
              left={
                <ProfileCell label="URL">
                  <LinkValue url={p?.website ?? null} />
                </ProfileCell>
              }
              right={
                <ProfileCell label="Sector">
                  {dash(p?.sector)}
                </ProfileCell>
              }
            />
            <ProfileDuoRow
              left={
                <ProfileCell label="Investor relations URL">
                  <LinkValue url={p?.irWebsite ?? null} />
                </ProfileCell>
              }
              right={
                <ProfileCell label="Industry">
                  {dash(p?.industry)}
                </ProfileCell>
              }
            />
            <ProfileDuoRow
              left={
                <ProfileCell label="Founded">
                  {dash(p?.foundedYear)}
                </ProfileCell>
              }
              right={
                <ProfileCell label="Employees">
                  {dash(p?.employees)}
                </ProfileCell>
              }
            />
            <ProfileDuoRow
              left={
                <ProfileCell label="Address">
                  {dash(p?.headquarters)}
                </ProfileCell>
              }
              right={
                <ProfileCell label="Phone number">
                  {dash(p?.phone)}
                </ProfileCell>
              }
            />
            <ProfileDuoRow
              left={
                <ProfileCell label="HQ state / province">
                  {dash(p?.hqState)}
                </ProfileCell>
              }
              right={
                <ProfileCell label="Equity style">
                  {dash(p?.equityStyle)}
                </ProfileCell>
              }
            />
            <ProfileDuoRow
              left={
                <ProfileCell label="Next earnings release">
                  {dash(p?.nextEarningsDate)}
                </ProfileCell>
              }
              right={
                <ProfileCell label="Last earnings release">
                  {dash(p?.lastEarningsDate)}
                </ProfileCell>
              }
            />
          </div>
        </>
      )}
    </div>
  );
}
