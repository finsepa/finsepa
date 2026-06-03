"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TabSwitcher } from "@/components/design-system";
import { Berkshire13fComparisonTable } from "@/components/superinvestors/berkshire-13f-comparison-table";
import { SuperinvestorTransactionsTable } from "@/components/superinvestors/superinvestor-transactions-table";
import type { Berkshire13fComparisonPayload, SuperinvestorTransactionsPayload } from "@/lib/superinvestors/types";

type ProfileTab = "holdings" | "transactions";

const TAB_OPTIONS = [
  { value: "holdings" as const, label: "Holdings" },
  { value: "transactions" as const, label: "Transactions" },
];

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
  const [txData, setTxData] = useState(transactions);
  const [txHistoryLoading, setTxHistoryLoading] = useState(false);
  const fullHistoryLoadedRef = useRef(false);

  useEffect(() => {
    setTxData(transactions);
    fullHistoryLoadedRef.current = false;
  }, [transactions]);

  useEffect(() => {
    fullHistoryLoadedRef.current = false;
  }, [txCompanySearch]);

  useEffect(() => {
    if (tab !== "transactions") return;

    const q = txCompanySearch.trim();
    if (q.length < 2) {
      setTxData(transactions);
      return;
    }
    if (fullHistoryLoadedRef.current) return;

    let cancelled = false;
    setTxHistoryLoading(true);
    void fetch(`/api/superinvestors/${encodeURIComponent(profileSlug)}/transactions`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as SuperinvestorTransactionsPayload;
      })
      .then((payload) => {
        if (cancelled || !payload?.quarters) return;
        fullHistoryLoadedRef.current = true;
        setTxData(payload);
      })
      .finally(() => {
        if (!cancelled) setTxHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tab, txCompanySearch, profileSlug, transactions]);

  const holdingsTransactions = transactions;

  const handleViewAllTransactions = useCallback((searchQuery: string) => {
    fullHistoryLoadedRef.current = false;
    setTxCompanySearch(searchQuery);
    setTab("transactions");
  }, []);

  return (
    <div className="mt-8">
      <TabSwitcher
        options={TAB_OPTIONS}
        value={tab}
        onChange={setTab}
        aria-label="Portfolio view"
        size="sm"
      />

      <div className="mt-4">
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
            data={txData}
            companySearch={txCompanySearch}
            onCompanySearchChange={setTxCompanySearch}
            historyLoading={txHistoryLoading}
          />
        )}
      </div>
    </div>
  );
}
