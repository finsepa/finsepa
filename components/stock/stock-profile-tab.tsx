"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { getStockDetailMetaFromTicker } from "@/lib/market/stock-detail-meta";
import type { StockProfilePayload } from "@/lib/market/stock-profile-types";

function dash(v: string | null | undefined): string {
  return v != null && String(v).trim() !== "" ? String(v).trim() : "—";
}

function ProfileRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-b border-[#E4E4E7] py-2.5 last:border-b-0">
      <div className="text-[12px] font-medium leading-4 text-[#71717A]">{label}</div>
      <div className="mt-1 min-h-[1.25rem] text-[14px] leading-5 text-[#09090B]">{children}</div>
    </div>
  );
}

function LinkValue({ url }: { url: string | null }) {
  if (!url?.trim()) return <span className="font-medium">—</span>;
  const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const display = url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium break-all text-[#09090B] underline decoration-[#E4E4E7] underline-offset-2 transition-colors hover:decoration-[#09090B]"
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
    return <p className="text-[14px] leading-[1.55] text-[#71717A]">—</p>;
  }

  return (
    <div>
      <div
        className={`overflow-hidden transition-[max-height] duration-300 ease-out ${
          open ? "max-h-[min(4800px,90vh)]" : "max-h-[4.65rem]"
        }`}
        id={contentId}
      >
        <p className="whitespace-pre-wrap text-[14px] leading-[1.55] text-[#71717A]">{text}</p>
      </div>
      {needsMore ? (
        <button
          type="button"
          className="mt-2 text-[13px] font-medium text-[#09090B] transition-colors hover:underline"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={contentId}
        >
          {open ? "Less" : "More…"}
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
      // SSR preloaded profile: render instantly, no client fetch / skeleton flash.
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
    <div className="space-y-6 pt-1">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]">
          {meta.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote favicon
            <img
              src={meta.logoUrl}
              alt=""
              width={56}
              height={56}
              className="h-full w-full object-contain p-1"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <span className="text-[18px] font-bold text-[#09090B]">{ticker.slice(0, 1)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold tracking-tight text-[#09090B]">About</h2>
          <div className="mt-2">
            {loading ? (
              <div className="space-y-2" aria-hidden>
                <div className="h-4 w-full max-w-xl rounded bg-neutral-200/90" />
                <div className="h-4 w-full max-w-lg rounded bg-neutral-200/90" />
                <div className="h-4 w-2/3 max-w-md rounded bg-neutral-200/90" />
              </div>
            ) : (
              <ProfileDescription text={p?.description ?? null} />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
        <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]">
          <h3 className="mb-1 text-[14px] font-semibold leading-5 text-[#09090B]">Company</h3>
          {loading ? (
            <div className="space-y-3 pt-2" aria-hidden>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 rounded-md bg-neutral-100" />
              ))}
            </div>
          ) : (
            <>
              <ProfileRow label="Website">
                <LinkValue url={p?.website ?? null} />
              </ProfileRow>
              <ProfileRow label="Investor relations">
                <LinkValue url={p?.irWebsite ?? null} />
              </ProfileRow>
              <ProfileRow label="Founded">{dash(p?.foundedYear)}</ProfileRow>
              <ProfileRow label="Headquarters">{dash(p?.headquarters)}</ProfileRow>
              <ProfileRow label="HQ state / province">{dash(p?.hqState)}</ProfileRow>
            </>
          )}
        </div>

        <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]">
          <h3 className="mb-1 text-[14px] font-semibold leading-5 text-[#09090B]">Markets &amp; reporting</h3>
          {loading ? (
            <div className="space-y-3 pt-2" aria-hidden>
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="h-10 rounded-md bg-neutral-100" />
              ))}
            </div>
          ) : (
            <>
              <ProfileRow label="Sector">{dash(p?.sector)}</ProfileRow>
              <ProfileRow label="Industry">{dash(p?.industry)}</ProfileRow>
              <ProfileRow label="Employees">{dash(p?.employees)}</ProfileRow>
              <ProfileRow label="Phone">{dash(p?.phone)}</ProfileRow>
              <ProfileRow label="Equity style">{dash(p?.equityStyle)}</ProfileRow>
              <ProfileRow label="Next earnings date">{dash(p?.nextEarningsDate)}</ProfileRow>
              <ProfileRow label="Last earnings date">{dash(p?.lastEarningsDate)}</ProfileRow>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
