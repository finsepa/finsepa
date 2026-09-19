"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { AppModalOverlay, APP_MODAL_DIALOG_ENTER_CLASS } from "@/components/ui/app-modal-overlay";
import {
  APP_MODAL_SHELL_OUTER_CLASS,
  AppModalCloseButton,
  AppModalShell,
} from "@/components/ui/app-modal-shell";
import { PauseSolid, PlaySolid, Smartphone } from "@/lib/icons";
import type {
  NvdaEarningsTranscript,
  NvdaTranscriptParagraph,
  NvdaTranscriptSpeaker,
  NvdaTranscriptWord,
} from "@/lib/market/nvda-earnings-transcript-fixture";
import { companyLogoUrlForTicker } from "@/lib/screener/company-logo-url";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  transcript: NvdaEarningsTranscript | null;
  onClose: () => void;
};

function speakerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function SpeakerAvatar({ speaker }: { speaker: NvdaTranscriptSpeaker }) {
  if (speaker.isOperator) {
    return (
      <div
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-fg-muted"
        aria-hidden
      >
        <Smartphone className="size-4" />
      </div>
    );
  }
  return (
    <div
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-fg text-[11px] font-semibold tracking-wide text-surface"
      aria-hidden
    >
      {speakerInitials(speaker.name)}
    </div>
  );
}

type CardState = "past" | "active" | "upcoming";

/** Split transcript into words (keeping whitespace) for karaoke highlighting. */
function splitWords(text: string): string[] {
  return text.split(/(\s+)/).filter((p) => p.length > 0);
}

function wordStartSec(
  order: number,
  n: number,
  timed: readonly NvdaTranscriptWord[] | null,
  startSec: number,
  endSec: number,
): number {
  if (timed && timed[order]) return timed[order]!.startSec;
  if (n <= 1) return startSec;
  return startSec + (order / n) * (endSec - startSec);
}

/** Highlight trails audio slightly so the lit word matches what you hear. */
const PLAYBACK_SYNC_LAG_SEC = 0.55;

function KaraokeText({
  text,
  startSec,
  endSec,
  words,
  currentSec,
  hoverSec,
  state,
  syncing,
  onSeekWord,
  onHoverWord,
}: {
  text: string;
  startSec: number | null | undefined;
  endSec: number | null | undefined;
  words?: readonly NvdaTranscriptWord[] | null;
  currentSec: number;
  hoverSec: number | null;
  state: CardState;
  /** Live audio sync is on — use time frontier across all cards. */
  syncing: boolean;
  onSeekWord?: (sec: number) => void;
  onHoverWord?: (sec: number | null) => void;
}) {
  const parts = splitWords(text);
  const timed = words && words.length > 0 ? words : null;
  const hasSpan =
    startSec != null &&
    endSec != null &&
    endSec > startSec &&
    (Boolean(onSeekWord) || state === "active" || hoverSec != null || syncing);

  if (!hasSpan) {
    return (
      <p
        className={cn(
          "whitespace-pre-wrap text-[14px] font-normal leading-6",
          state === "upcoming" ? "text-fg-muted" : "text-fg",
        )}
      >
        {text}
      </p>
    );
  }

  const speechIdx: number[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (/\S/.test(parts[i]!)) speechIdx.push(i);
  }
  const n = speechIdx.length;
  const t0 = startSec as number;
  const t1 = endSec as number;
  // Playback frontier only — hover must not rewrite the spoken trail.
  const playFrontier =
    syncing ? Math.max(0, currentSec - PLAYBACK_SYNC_LAG_SEC) : null;

  return (
    <p className="whitespace-pre-wrap text-[14px] font-normal leading-6">
      {parts.map((part, i) => {
        if (!/\S/.test(part)) {
          return <span key={i}>{part}</span>;
        }
        const order = speechIdx.indexOf(i);
        const at = order >= 0 ? wordStartSec(order, n, timed, t0, t1) : null;

        let spoken = state === "past";
        if (playFrontier != null && at != null) {
          spoken = at <= playFrontier;
        } else if (state === "upcoming") {
          spoken = false;
        } else if (state === "active" && order >= 0 && timed == null) {
          const span = t1 - t0;
          const progress = Math.min(
            1,
            Math.max(0, (currentSec - PLAYBACK_SYNC_LAG_SEC - t0) / span),
          );
          const spokenCount = n === 0 ? 0 : Math.min(n, Math.floor(progress * n));
          spoken = order < spokenCount;
        }

        const seekSec = onSeekWord && at != null ? at : null;
        const isHoverWord =
          hoverSec != null && seekSec != null && Math.abs(seekSec - hoverSec) < 0.02;

        return (
          <span
            key={i}
            role={seekSec != null ? "button" : undefined}
            tabIndex={seekSec != null ? 0 : undefined}
            onClick={
              seekSec != null
                ? (e) => {
                    e.stopPropagation();
                    onSeekWord!(seekSec);
                  }
                : undefined
            }
            onKeyDown={
              seekSec != null
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      onSeekWord!(seekSec);
                    }
                  }
                : undefined
            }
            onPointerEnter={
              seekSec != null && onHoverWord
                ? () => onHoverWord(seekSec)
                : undefined
            }
            className={cn(
              "rounded-[2px] transition-colors duration-75",
              spoken || !syncing ? "text-fg" : "text-fg-muted",
              isHoverWord && "bg-fg/[0.1]",
              seekSec != null &&
                "cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fg/30",
            )}
          >
            {part}
          </span>
        );
      })}
    </p>
  );
}

function SpeakerCard({
  speaker,
  text,
  startSec,
  endSec,
  words,
  currentSec,
  hoverSec,
  state,
  syncing,
  seekable,
  onSeekStart,
  onSeekWord,
  onHoverWord,
}: {
  speaker: NvdaTranscriptSpeaker;
  text: string;
  startSec?: number | null;
  endSec?: number | null;
  words?: readonly NvdaTranscriptWord[] | null;
  currentSec: number;
  hoverSec: number | null;
  state: CardState;
  syncing: boolean;
  seekable: boolean;
  onSeekStart: () => void;
  onSeekWord: (sec: number) => void;
  onHoverWord?: (sec: number | null) => void;
}) {
  const muted = state === "upcoming";
  return (
    <article
      className={cn(
        "rounded-2xl border bg-surface px-4 py-3.5 shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-04))] transition-colors dark:border-stroke-shell",
        state === "active" ? "border-fg/40 ring-1 ring-fg/15" : "border-stroke",
      )}
    >
      <header
        className={cn(
          "mb-4 flex items-center gap-2.5",
          seekable && "cursor-pointer rounded-lg -mx-1 px-1 hover:bg-fg/[0.03]",
        )}
        onClick={seekable ? onSeekStart : undefined}
        onKeyDown={
          seekable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSeekStart();
                }
              }
            : undefined
        }
        role={seekable ? "button" : undefined}
        tabIndex={seekable ? 0 : undefined}
      >
        <SpeakerAvatar speaker={speaker} />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate text-[14px] font-semibold leading-5",
              muted ? "text-fg-muted" : "text-fg",
            )}
          >
            {speaker.name}
          </p>
          {speaker.role ? (
            <p className="truncate text-[12px] font-normal leading-4 text-fg-muted">{speaker.role}</p>
          ) : null}
        </div>
      </header>
      <KaraokeText
        text={text}
        startSec={startSec}
        endSec={endSec}
        words={words}
        currentSec={currentSec}
        hoverSec={hoverSec}
        state={state}
        syncing={syncing}
        onSeekWord={seekable ? onSeekWord : undefined}
        onHoverWord={seekable ? onHoverWord : undefined}
      />
    </article>
  );
}

function activeParagraphIndex(
  paragraphs: readonly NvdaTranscriptParagraph[],
  currentSec: number,
): number {
  const t = Math.max(0, currentSec - PLAYBACK_SYNC_LAG_SEC);
  let idx = 0;
  for (let i = 0; i < paragraphs.length; i++) {
    const start = paragraphs[i]!.startSec;
    if (start == null) continue;
    if (start <= t + 0.05) idx = i;
    else break;
  }
  return idx;
}

function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function EarningsTranscriptModal({ open, transcript, onClose }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [playing, setPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [audioReady, setAudioReady] = useState(false);
  const [audioError, setAudioError] = useState(false);

  const speakersById = useMemo(() => {
    const map = new Map<number, NvdaTranscriptSpeaker>();
    for (const s of transcript?.speakers ?? []) map.set(s.id, s);
    return map;
  }, [transcript]);

  const hasTimedParagraphs = Boolean(
    transcript?.paragraphs.some((p) => p.startSec != null && Number.isFinite(p.startSec)),
  );
  const audioUrl = transcript?.audioUrl?.trim() || null;
  const canSync = Boolean(audioUrl && hasTimedParagraphs && !audioError);

  const activeIdx = useMemo(
    () => (transcript ? activeParagraphIndex(transcript.paragraphs, currentSec) : 0),
    [transcript, currentSec],
  );

  /** Don't highlight a card until playback/seek has actually moved off the start. */
  const syncHighlight = canSync && audioReady && (playing || currentSec > 0.25);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onKeyDown]);

  useEffect(() => {
    if (!open) {
      audioRef.current?.pause();
      setPlaying(false);
      setCurrentSec(0);
      setAudioReady(false);
      setAudioError(false);
      setHoverSeekRatio(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !syncHighlight) return;
    const el = cardRefs.current[activeIdx];
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeIdx, open, syncHighlight]);

  const [hoverSeekRatio, setHoverSeekRatio] = useState<number | null>(null);
  const [hoverWordSec, setHoverWordSec] = useState<number | null>(null);

  const seekToSec = useCallback(
    (sec: number) => {
      const audio = audioRef.current;
      if (!audio || !canSync || !Number.isFinite(sec)) return;
      const next = Math.max(0, sec);
      audio.currentTime = next;
      setCurrentSec(next);
      void audio.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
    },
    [canSync],
  );

  const seekToParagraph = useCallback(
    (index: number) => {
      const start = transcript?.paragraphs[index]?.startSec;
      if (start == null) return;
      seekToSec(start);
    },
    [transcript, seekToSec],
  );

  const seekToRatio = useCallback(
    (ratio: number) => {
      const audio = audioRef.current;
      const dur = durationSec || transcript?.durationSec || 0;
      if (!audio || !canSync || dur <= 0) return;
      const next = Math.min(dur, Math.max(0, ratio * dur));
      audio.currentTime = next;
      setCurrentSec(next);
    },
    [canSync, durationSec, transcript?.durationSec],
  );

  const ratioFromPointer = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  }, []);

  const onProgressPointer = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!canSync || audioError) return;
      const ratio = ratioFromPointer(e);
      setHoverSeekRatio(ratio);
      seekToRatio(ratio);
    },
    [canSync, audioError, ratioFromPointer, seekToRatio],
  );

  const onProgressHover = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!canSync || audioError) return;
      const ratio = ratioFromPointer(e);
      setHoverSeekRatio(ratio);
      if (e.buttons === 1 || e.currentTarget.hasPointerCapture(e.pointerId)) {
        seekToRatio(ratio);
      }
    },
    [canSync, audioError, ratioFromPointer, seekToRatio],
  );

  const onProgressKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!canSync || audioError) return;
      const dur = durationSec || transcript?.durationSec || 0;
      if (dur <= 0) return;
      const step = e.shiftKey ? 15 : 5;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        seekToRatio(Math.min(1, (currentSec + step) / dur));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        seekToRatio(Math.max(0, (currentSec - step) / dur));
      } else if (e.key === "Home") {
        e.preventDefault();
        seekToRatio(0);
      } else if (e.key === "End") {
        e.preventDefault();
        seekToRatio(1);
      }
    },
    [canSync, audioError, durationSec, transcript?.durationSec, currentSec, seekToRatio],
  );

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !canSync) return;
    if (audio.paused) {
      void audio.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
    } else {
      audio.pause();
      setPlaying(false);
    }
  }, [canSync]);

  if (!open || !transcript) return null;

  const title = `${transcript.companyName} · ${transcript.fiscalPeriodLabel}`;
  const logoUrl = companyLogoUrlForTicker(transcript.ticker, "nvidia.com");
  const totalDur = durationSec || transcript.durationSec || 0;
  const progress = totalDur > 0 ? Math.min(1, Math.max(0, currentSec / totalDur)) : 0;

  // Leave room under the transcript for the player + 20px gap + overlay padding.
  // Inline size so it always applies (complex Tailwind arbitrary heights were not constraining).
  const transcriptShellStyle = {
    height: "min(calc(100dvh - 9.5rem), 760px)",
    maxHeight: "min(calc(100dvh - 9.5rem), 760px)",
  } as const;

  return (
    <AppModalOverlay open={open} onClose={onClose} zIndex={300}>
      <div
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[min(1120px,calc(100vw-1.5rem))] flex-col gap-5 overflow-hidden sm:max-h-[calc(100dvh-2rem)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="min-h-0 w-full shrink overflow-hidden" style={transcriptShellStyle}>
          <AppModalShell
            titleId="earnings-transcript-title"
            className="h-full max-h-full overflow-hidden"
            maxWidthClass="h-full w-full max-w-none"
            maxHeightClass="h-full max-h-full min-h-0"
            bodyScroll
            header={
              <div className="flex w-full min-w-0 items-center justify-between gap-3">
                <h2
                  id="earnings-transcript-title"
                  className="min-w-0 truncate text-[16px] font-semibold leading-6 text-fg sm:text-[17px]"
                >
                  {title}
                </h2>
                <AppModalCloseButton onClick={onClose} />
              </div>
            }
            headerClassName="px-4 py-3 sm:px-5"
            bodyClassName="earnings-transcript-scroll min-h-0 flex-1 overflow-y-auto bg-surface-muted px-3 py-3 sm:px-4 sm:py-4"
            cardClassName="min-h-0 overflow-hidden"
          >
            {audioUrl ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption -- earnings call archive; no caption track yet
              <audio
                ref={audioRef}
                src={audioUrl}
                preload="metadata"
                onLoadedMetadata={(e) => {
                  const d = e.currentTarget.duration;
                  if (Number.isFinite(d) && d > 0) setDurationSec(d);
                  setAudioReady(true);
                  setAudioError(false);
                }}
                onTimeUpdate={(e) => setCurrentSec(e.currentTarget.currentTime)}
                onPlay={() => {
                  setPlaying(true);
                  setHoverWordSec(null);
                }}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
                onError={() => {
                  setAudioError(true);
                  setAudioReady(false);
                  setPlaying(false);
                }}
              />
            ) : null}

            <div
              className="mx-auto flex w-full max-w-[720px] flex-col gap-3 pb-2"
              onPointerLeave={() => setHoverWordSec(null)}
            >
              {audioUrl && audioError ? (
                <p className="rounded-xl border border-stroke bg-surface px-3 py-2 text-[13px] text-fg-muted dark:border-stroke-shell">
                  Audio file not found yet. Place the archived webcast at{" "}
                  <code className="text-fg">public/earnings-audio/NVDA/q2-2027.mp3</code> (or run
                  the align script), then refresh.
                </p>
              ) : null}
              {transcript.paragraphs.map((p, i) => {
                const speaker = speakersById.get(p.speakerId);
                if (!speaker) return null;
                const state: CardState =
                  !syncHighlight ? "past"
                  : i < activeIdx ? "past"
                  : i === activeIdx ? "active"
                  : "upcoming";
                return (
                  <div
                    key={`${p.speakerId}-${i}`}
                    ref={(el) => {
                      cardRefs.current[i] = el;
                    }}
                  >
                    <SpeakerCard
                      speaker={speaker}
                      text={p.text}
                      startSec={p.startSec}
                      endSec={p.endSec}
                      words={p.words}
                      currentSec={currentSec}
                      hoverSec={!playing ? hoverWordSec : null}
                      state={state}
                      syncing={syncHighlight}
                      seekable={canSync && p.startSec != null}
                      onSeekStart={() => seekToParagraph(i)}
                      onSeekWord={seekToSec}
                      onHoverWord={playing ? undefined : setHoverWordSec}
                    />
                  </div>
                );
              })}
            </div>
          </AppModalShell>
        </div>

        {audioUrl ? (
          <div
            className={cn(
              APP_MODAL_DIALOG_ENTER_CLASS,
              APP_MODAL_SHELL_OUTER_CLASS,
              "w-full shrink-0",
            )}
          >
            <div className="flex items-center gap-3 px-4 pt-3.5 pb-1.5 sm:px-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt=""
                className="size-9 shrink-0 rounded-lg bg-surface-muted object-contain"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold leading-5 text-fg">
                  {transcript.companyName}
                </p>
                <p className="truncate text-[12px] leading-4 text-fg-muted">
                  {transcript.fiscalPeriodLabel}
                  {totalDur > 0
                    ? ` · ${formatClock(currentSec)} / ${formatClock(totalDur)}`
                    : null}
                </p>
              </div>
              <button
                type="button"
                onClick={togglePlay}
                disabled={!canSync || audioError}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-fg text-surface transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? (
                  <PauseSolid className="size-4" aria-hidden />
                ) : (
                  <PlaySolid className="size-4 translate-x-px" aria-hidden />
                )}
              </button>
            </div>
            <div className="px-4 pb-1.5 pt-0 sm:px-5">
              <div
                role="slider"
                aria-label="Seek audio"
                aria-valuemin={0}
                aria-valuemax={Math.round(totalDur)}
                aria-valuenow={Math.round(currentSec)}
                aria-valuetext={`${formatClock(currentSec)} of ${formatClock(totalDur)}`}
                tabIndex={canSync && !audioError ? 0 : -1}
                className={cn(
                  "group relative flex h-5 w-full touch-none items-center",
                  canSync && !audioError
                    ? "cursor-pointer"
                    : "pointer-events-none opacity-60",
                )}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  onProgressPointer(e);
                }}
                onPointerMove={onProgressHover}
                onPointerEnter={onProgressHover}
                onPointerLeave={() => setHoverSeekRatio(null)}
                onKeyDown={onProgressKeyDown}
              >
                {hoverSeekRatio != null && totalDur > 0 ? (
                  <div
                    className="pointer-events-none absolute bottom-full z-10 mb-1.5 -translate-x-1/2 rounded-md bg-fg px-2 py-1 text-[12px] font-medium leading-none tabular-nums text-surface shadow-sm"
                    style={{ left: `${hoverSeekRatio * 100}%` }}
                  >
                    {formatClock(hoverSeekRatio * totalDur)}
                  </div>
                ) : null}
                <div className="relative h-1 w-full rounded-full bg-stroke dark:bg-stroke-shell">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-fg transition-[width] duration-75 group-active:transition-none"
                    style={{ width: `${progress * 100}%` }}
                  />
                  <div
                    className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-100"
                    style={{
                      left: `${(hoverSeekRatio ?? progress) * 100}%`,
                    }}
                    aria-hidden
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppModalOverlay>
  );
}
