/**
 * Async RSC wrapper: yield once so the above-fold stock shell (header / chart) can
 * flush before KI / key stats / news HTML. No provider / EODHD work.
 */
export async function YieldForStreaming({ children }: { children: React.ReactNode }) {
  await new Promise<void>((resolve) => {
    if (typeof setImmediate === "function") {
      setImmediate(() => resolve());
    } else {
      setTimeout(() => resolve(), 0);
    }
  });
  return children;
}
