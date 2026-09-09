"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, type ReadonlyURLSearchParams } from "next/navigation";

function SearchParamsBridgeInner({
  onChange,
}: {
  onChange: (params: ReadonlyURLSearchParams) => void;
}) {
  const searchParams = useSearchParams();
  useEffect(() => {
    onChange(searchParams);
  }, [searchParams, onChange]);
  return null;
}

/**
 * Isolates `useSearchParams` behind a null Suspense fallback so asset pages can
 * paint from SSR props instead of blanking the whole tree (fallback={null} on
 * the page root) or flashing a second full-page skeleton.
 */
export function SearchParamsBridge({
  onChange,
}: {
  onChange: (params: ReadonlyURLSearchParams) => void;
}) {
  return (
    <Suspense fallback={null}>
      <SearchParamsBridgeInner onChange={onChange} />
    </Suspense>
  );
}
