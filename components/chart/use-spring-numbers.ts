"use client";

import { useEffect, useRef, useState } from "react";

type SpringOpts = {
  /** Higher = snappier. Typical: 260–520 */
  stiffness?: number;
  /** Higher = less bouncy, more damped. Typical: 22–38 */
  damping?: number;
  /** Stop threshold in display units. */
  epsilon?: number;
};

type Triple = {
  price: number | null;
  abs: number | null;
  pct: number | null;
};

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Robinhood-style smooth numeric spring for (price, abs change, pct change).
 * - Keeps values in sync (single rAF loop + single state set)
 * - Handles rapid target changes without restarting the animation
 * - Avoids heavy libs
 */
export function useSpringTriplet(target: Triple, opts: SpringOpts = {}): Triple {
  const { stiffness = 420, damping = 34, epsilon = 1e-4 } = opts;

  const [value, setValue] = useState<Triple>(target);

  const runningRef = useRef(false);
  const rafRef = useRef<number>(0);
  const lastTRef = useRef<number>(0);

  const xRef = useRef<Triple>({ price: null, abs: null, pct: null });
  const vRef = useRef<{ price: number; abs: number; pct: number }>({ price: 0, abs: 0, pct: 0 });
  const targetRef = useRef<Triple>(target);

  useEffect(() => {
    targetRef.current = target;

    const t = targetRef.current;
    const x = xRef.current;

    // If a field becomes null, snap immediately (matches existing fallback behavior).
    if (!isNum(t.price) || !isNum(t.abs) || !isNum(t.pct)) {
      xRef.current = { price: t.price, abs: t.abs, pct: t.pct };
      vRef.current = { price: 0, abs: 0, pct: 0 };
      runningRef.current = false;
      cancelAnimationFrame(rafRef.current);
      setValue({ price: t.price, abs: t.abs, pct: t.pct });
      return;
    }

    // Initialize from current if unset.
    if (!isNum(x.price) || !isNum(x.abs) || !isNum(x.pct)) {
      xRef.current = { price: t.price, abs: t.abs, pct: t.pct };
      vRef.current = { price: 0, abs: 0, pct: 0 };
      setValue({ price: t.price, abs: t.abs, pct: t.pct });
      return;
    }

    if (runningRef.current) return;

    runningRef.current = true;
    lastTRef.current = performance.now();

    const tick = (now: number) => {
      const last = lastTRef.current || now;
      let dt = (now - last) / 1000;
      // Clamp dt to avoid huge jumps on tab switch / main-thread stalls.
      if (!Number.isFinite(dt) || dt <= 0) dt = 1 / 60;
      dt = Math.min(1 / 20, dt);
      lastTRef.current = now;

      const tgt = targetRef.current;
      const xx = xRef.current;
      const vv = vRef.current;

      const stepOne = (key: keyof Triple) => {
        const xk = xx[key] as number;
        const tk = tgt[key] as number;
        const vk = vv[key as "price" | "abs" | "pct"];

        const a = (tk - xk) * stiffness;
        const vNext = (vk + a * dt) * Math.exp(-damping * dt);
        const xNext = xk + vNext * dt;
        vv[key as "price" | "abs" | "pct"] = vNext;
        if (key === "price") xx.price = xNext;
        else if (key === "abs") xx.abs = xNext;
        else xx.pct = xNext;
      };

      stepOne("price");
      stepOne("abs");
      stepOne("pct");

      xRef.current = xx;
      vRef.current = vv;

      setValue({ price: xx.price, abs: xx.abs, pct: xx.pct });

      const done =
        Math.abs((tgt.price as number) - (xx.price as number)) < epsilon &&
        Math.abs((tgt.abs as number) - (xx.abs as number)) < epsilon &&
        Math.abs((tgt.pct as number) - (xx.pct as number)) < epsilon &&
        Math.abs(vv.price) < epsilon &&
        Math.abs(vv.abs) < epsilon &&
        Math.abs(vv.pct) < epsilon;

      if (!done) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        runningRef.current = false;
        // Snap to exact targets at rest.
        xRef.current = { price: tgt.price, abs: tgt.abs, pct: tgt.pct };
        vRef.current = { price: 0, abs: 0, pct: 0 };
        setValue({ price: tgt.price, abs: tgt.abs, pct: tgt.pct });
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      runningRef.current = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [target.price, target.abs, target.pct, stiffness, damping, epsilon]);

  return value;
}

