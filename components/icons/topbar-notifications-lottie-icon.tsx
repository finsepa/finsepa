"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";

import notificationsBellIconAnimation from "@/lib/lottie/notifications-bell-icon.json";
import { cn } from "@/lib/utils";

type TopbarNotificationsLottieIconProps = {
  /** When true, loop the ringtone animation (unread / red-dot state). When false, hold frame 0. */
  alerting: boolean;
  className?: string;
};

/** SSR / parse fallback — same as light `--fs-icon` (button icons). */
const LIGHT_ICON_RGBA: [number, number, number, number] = [0.078, 0.078, 0.078, 1]; // #141414

function hexToLottieRgba(hex: string): [number, number, number, number] | null {
  const raw = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(raw)) return null;
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  const n = Number.parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
}

function cssColorToLottieRgba(cssColor: string): [number, number, number, number] | null {
  const trimmed = cssColor.trim();
  const hex = hexToLottieRgba(trimmed);
  if (hex) return hex;

  const rgb = trimmed.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i,
  );
  if (rgb) {
    return [
      Number(rgb[1]) / 255,
      Number(rgb[2]) / 255,
      Number(rgb[3]) / 255,
      rgb[4] != null ? Number(rgb[4]) : 1,
    ];
  }

  const rgbSpace = trimmed.match(
    /^rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/i,
  );
  if (rgbSpace) {
    return [
      Number(rgbSpace[1]) / 255,
      Number(rgbSpace[2]) / 255,
      Number(rgbSpace[3]) / 255,
      rgbSpace[4] != null ? Number(rgbSpace[4]) : 1,
    ];
  }

  const srgb = trimmed.match(
    /^color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/i,
  );
  if (srgb) {
    return [
      Number(srgb[1]),
      Number(srgb[2]),
      Number(srgb[3]),
      srgb[4] != null ? Number(srgb[4]) : 1,
    ];
  }

  return null;
}

function resolveIconRgba(el: HTMLElement | null): [number, number, number, number] {
  if (typeof document === "undefined") return LIGHT_ICON_RGBA;
  if (el) {
    const fromEl = cssColorToLottieRgba(getComputedStyle(el).color);
    if (fromEl) return fromEl;
  }
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--fs-icon").trim();
  return hexToLottieRgba(raw) ?? cssColorToLottieRgba(raw) ?? LIGHT_ICON_RGBA;
}

function recolorMenuLottie(data: unknown, rgba: [number, number, number, number]): unknown {
  const clone = structuredClone(data) as Record<string, unknown>;

  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    const obj = node as Record<string, unknown>;
    if ((obj.ty === "fl" || obj.ty === "st") && obj.c && typeof obj.c === "object") {
      const c = obj.c as { k?: unknown; a?: number };
      if (Array.isArray(c.k) && c.k.length >= 3 && typeof c.k[0] === "number") {
        c.k = [...rgba];
        c.a = 0;
      }
    }
    if (obj.ty === "st" && obj.w && typeof obj.w === "object") {
      const w = obj.w as { k?: unknown; a?: number };
      if (w.a === 0 && typeof w.k === "number") {
        w.k = w.k * 1.35;
      }
    }
    for (const value of Object.values(obj)) walk(value);
  };

  walk(clone);
  return clone;
}

function rgbaEqual(
  a: [number, number, number, number],
  b: [number, number, number, number],
): boolean {
  return (
    Math.abs(a[0] - b[0]) < 0.002 &&
    Math.abs(a[1] - b[1]) < 0.002 &&
    Math.abs(a[2] - b[2]) < 0.002 &&
    Math.abs(a[3] - b[3]) < 0.002
  );
}

/**
 * Topbar notifications bell. Static by default; loops only while there are unread alerts
 * (same condition as the red unread dot) — never plays on hover.
 *
 * Render only via `dynamic(..., { ssr: false })` / client mounts — lottie-react SSR markup
 * does not match the client tree.
 */
export function TopbarNotificationsLottieIcon({
  alerting,
  className,
}: TopbarNotificationsLottieIconProps) {
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const rootRef = useRef<HTMLSpanElement>(null);
  const alertingRef = useRef(alerting);
  const [iconRgba, setIconRgba] = useState<[number, number, number, number]>(LIGHT_ICON_RGBA);

  alertingRef.current = alerting;

  useLayoutEffect(() => {
    const sync = () => {
      const next = resolveIconRgba(rootRef.current);
      setIconRgba((prev) => (rgbaEqual(prev, next) ? prev : next));
    };
    sync();

    const root = document.documentElement;
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class", "style"] });
    return () => observer.disconnect();
  }, []);

  const tintedAnimation = useMemo(
    () => recolorMenuLottie(notificationsBellIconAnimation, iconRgba),
    [iconRgba],
  );

  useEffect(() => {
    const anim = lottieRef.current;
    if (!anim) return;
    if (alerting) {
      anim.goToAndPlay(0, true);
    } else {
      anim.goToAndStop(0, true);
    }
  }, [alerting, tintedAnimation]);

  return (
    <span
      ref={rootRef}
      className={cn("relative inline-flex h-5 w-5 shrink-0 overflow-visible text-current", className)}
      aria-hidden
    >
      <Lottie
        lottieRef={lottieRef}
        animationData={tintedAnimation}
        loop={alerting}
        autoplay={false}
        onDOMLoaded={() => {
          if (alertingRef.current) {
            lottieRef.current?.goToAndPlay(0, true);
          } else {
            lottieRef.current?.goToAndStop(0, true);
          }
        }}
        style={{ width: "100%", height: "100%" }}
      />
    </span>
  );
}
