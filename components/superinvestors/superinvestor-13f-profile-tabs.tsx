"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UnderlineTabs, type UnderlineTabOption } from "@/components/screener/market-tabs";
import { Berkshire13fComparisonTable } from "@/components/superinvestors/berkshire-13f-comparison-table";
import { SuperinvestorTransactionsTable } from "@/components/superinvestors/superinvestor-transactions-table";
import type { Berkshire13fComparisonPayload, SuperinvestorTransactionsPayload } from "@/lib/superinvestors/types";

const FULL_HISTORY_SEARCH_DEBOUNCE_MS = 500;

type ProfileTab = "holdings" | "activity";

const TAB_OPTIONS: readonly UnderlineTabOption<ProfileTab>[] = [
  { value: "holdings", label: "Holdings" },
  { value: "activity", label: "Activity" },
];

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export function Superinvestor13fProfileTabs({
  profileSlug,
  profileName,
  data,
  transactions,
}: {
  profileSlug: string;
  profileName: string;
  data: Berkshire13fComparisonPayload;
  transactions: SuperinvestorTransactionsPayload;
}) {
  const [tab, setTab] = useState<ProfileTab>("holdings");
  const [txCompanySearch, setTxCompanySearch] = useState("");
  const [fullHistory, setFullHistory] = useState<SuperinvestorTransactionsPayload | null>(null);
  const [txHistoryLoading, setTxHistoryLoading] = useState(false);
  const fullHistoryFetchStartedRef = useRef(false);

  const debouncedCompanySearch = useDebouncedValue(txCompanySearch, FULL_HISTORY_SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    setFullHistory(null);
    fullHistoryFetchStartedRef.current = false;
  }, [transactions]);

  const activityData = useMemo(() => {
    const q = txCompanySearch.trim();
    if (q.length < 2) return transactions;
    return fullHistory ?? transactions;
  }, [transactions, fullHistory, txCompanySearch]);

  useEffect(() => {
    if (tab !== "activity") return;

    const q = debouncedCompanySearch.trim();
    if (q.length < 2) {
      setTxHistoryLoading(false);
      return;
    }
    if (fullHistory) return;
    if (fullHistoryFetchStartedRef.current) return;

    fullHistoryFetchStartedRef.current = true;
    let cancelled = false;
    setTxHistoryLoading(true);
    void fetch(`/api/superinvestors/${encodeURIComponent(profileSlug)}/transactions`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as SuperinvestorTransactionsPayload;
      })
      .then((payload) => {
        if (cancelled) return;
        if (payload?.quarters) setFullHistory(payload);
        else fullHistoryFetchStartedRef.current = false;
      })
      .finally(() => {
        if (!cancelled) setTxHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tab, debouncedCompanySearch, profileSlug, transactions, fullHistory]);

  const holdingsTransactions = transactions;

  const handleViewAllTransactions = useCallback((searchQuery: string) => {
    setFullHistory(null);
    fullHistoryFetchStartedRef.current = false;
    setTxCompanySearch(searchQuery);
    setTab("activity");
  }, []);

  return (
    <div className="mt-8">
      <UnderlineTabs<ProfileTab>
        tabs={TAB_OPTIONS}
        active={tab}
        onChange={setTab}
        ariaLabel="Portfolio view"
      />

      {tab === "holdings" ? (
          <>
            {!data.hasPriorFiling && data.source !== "unavailable" ? (
              <p className="mb-4 max-w-3xl text-sm text-[#71717A]">
                Only one 13F-HR filing appears in the SEC feed; change badges and prior columns are hidden until a
                second filing is available.
              </p>
            ) : null}
            <Berkshire13fComparisonTable
              key={profileName}
              rows={data.rows}
              hasPriorFiling={data.hasPriorFiling}
              transactions={holdingsTransactions}
              onViewAllTransactions={handleViewAllTransactions}
            />
          </>
      ) : (
        <SuperinvestorTransactionsTable
          data={activityData}
          companySearch={txCompanySearch}
          onCompanySearchChange={setTxCompanySearch}
          historyLoading={txHistoryLoading}
        />
      )}
    </div>
  );
}
