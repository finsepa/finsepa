import { cn } from "@/lib/utils";

import {
  AUTH_ASIDE_MOCKUP_CANVAS,
  AUTH_ASIDE_MOCKUP_IMAGE,
  AUTH_ASIDE_MOCKUP_ROWS,
} from "./auth-aside-mockup-data";

function mockupSrcSet(src: string) {
  const match = src.match(/\.(jpe?g|png|webp)$/i);
  if (!match) return undefined;
  const ext = match[0];
  const base = src.slice(0, -ext.length);
  return `${src} 1x, ${base}-2x${ext} 2x`;
}

const ROW_SCROLL_DURATIONS_S = [118, 126, 114, 122, 120] as const;
/** Negative delays start each row mid-cycle so refresh never shows an empty strip. */
const ROW_SCROLL_DELAYS_S = [-24, -58, -36, -71, -49] as const;

function AuthMockupCard({ src }: { src: string }) {
  return (
    <div className="shrink-0 overflow-hidden rounded-[16px] border border-[rgba(228,228,231,0.5)]">
      <div className="overflow-hidden rounded-[14px] border-2 border-[#E4E4E7] p-[2px] shadow-[0_20px_12px_rgba(10,10,10,0.1),0_8px_4px_rgba(10,10,10,0.04)]">
        <div className="h-[319.437px] w-[480px] overflow-hidden rounded-[14px] bg-white">
          <img
            src={src}
            srcSet={mockupSrcSet(src)}
            alt=""
            width={AUTH_ASIDE_MOCKUP_IMAGE.width}
            height={AUTH_ASIDE_MOCKUP_IMAGE.height}
            sizes="500px"
            decoding="async"
            loading="lazy"
            fetchPriority="low"
            className="auth-aside-mockup-img block h-full w-full max-w-none object-cover object-top"
          />
        </div>
      </div>
    </div>
  );
}

function AuthMockupRow({
  screens,
  positionClassName,
  rowIndex,
}: {
  screens: readonly string[];
  positionClassName: string;
  rowIndex: number;
}) {
  const duration = ROW_SCROLL_DURATIONS_S[rowIndex] ?? 90;
  const delay = ROW_SCROLL_DELAYS_S[rowIndex] ?? 0;
  const loopScreens = [...screens, ...screens, ...screens];

  return (
    <div
      className={cn(
        "absolute -translate-x-1/2 overflow-hidden",
        positionClassName,
      )}
      style={{ width: AUTH_ASIDE_MOCKUP_CANVAS.width }}
    >
      <div
        className="auth-aside-row-scroll flex w-max items-center gap-5"
        style={{
          animationDuration: `${duration}s`,
          animationDelay: `${delay}s`,
          animationDirection: rowIndex % 2 === 1 ? "reverse" : "normal",
        }}
      >
        {loopScreens.map((src, index) => (
          <AuthMockupCard key={`${rowIndex}-${index}`} src={src} />
        ))}
      </div>
    </div>
  );
}

/** Right rail on auth split screens — Figma mockup collage with slow row drift (8882:126370). */
export function AuthSplitAsidePanel() {
  const { width, height, scale, renderScale } = AUTH_ASIDE_MOCKUP_CANVAS;
  const rasterScale = scale * renderScale;

  return (
    <div
      className="relative h-full min-h-[calc(100dvh-8px)] w-full overflow-hidden rounded-[8px] bg-[#FAFAFA]"
      aria-hidden
    >
      <div className="absolute inset-0 [background-image:radial-gradient(circle,rgba(228,228,231,0.3)_2px,transparent_2px)] [background-size:12px_14px]" />

      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-[56%] top-[58%] -translate-x-1/2 -translate-y-1/2">
          <div
            className="auth-aside-collage relative"
            style={{
              width,
              height,
              transform: `translate(6%, 5%) scale(${rasterScale}) rotate(-25deg) scale(${1 / renderScale})`,
              transformOrigin: "center center",
            }}
          >
            {AUTH_ASIDE_MOCKUP_ROWS.map((row, rowIndex) => (
              <AuthMockupRow
                key={row.positionClassName}
                rowIndex={rowIndex}
                screens={row.screens}
                positionClassName={row.positionClassName}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
