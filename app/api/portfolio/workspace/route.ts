import { NextResponse } from "next/server";

import {
  FREE_HOLDINGS_LIMIT_CODE,
  findFreeHoldingsPersistViolation,
  freeHoldingsLimitMessage,
} from "@/lib/account/free-plan-asset-limits";
import { getSubscriptionGateContext } from "@/lib/account/subscription-gate";
import { requireAuthUserFromRequest, AuthRequiredError } from "@/lib/watchlist/api-auth";
import {
  type PersistedPortfolioState,
  parsePersistedPortfolioUnknown,
} from "@/lib/portfolio/portfolio-storage";
import { getSupabaseClientForRequest } from "@/lib/supabase/request-client";
import { isPortfolioLedgerStrictPersistEnabled } from "@/lib/features/portfolio-correctness";
import { prepareWorkspaceLedgerForPersist } from "@/lib/portfolio/ledger/portfolio-ledger-prepare";
import { validateWorkspaceState } from "@/lib/portfolio/ledger/portfolio-ledger-validate";

function summarizeState(s: PersistedPortfolioState): { portfolioCount: number; holdingCount: number; txCount: number } {
  let holdingCount = 0;
  let txCount = 0;
  for (const p of s.portfolios) {
    holdingCount += s.holdingsByPortfolioId[p.id]?.length ?? 0;
    txCount += s.transactionsByPortfolioId[p.id]?.length ?? 0;
  }
  return { portfolioCount: s.portfolios.length, holdingCount, txCount };
}

/** Auth: Bearer or cookie via `requireAuthUserFromRequest` (native iOS clients). */
export async function GET(request: Request) {
  try {
    const user = await requireAuthUserFromRequest(request);
    const supabase = await getSupabaseClientForRequest(request);

    const { data, error } = await supabase
      .from("portfolio_workspace")
      .select("state,updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[portfolio/workspace GET]", error.message);
      return NextResponse.json({ state: null, updatedAt: null, warning: "db_unavailable" as const });
    }

    if (!data?.state) {
      return NextResponse.json({ state: null, updatedAt: null });
    }

    const state = parsePersistedPortfolioUnknown(data.state);
    if (!state) {
      return NextResponse.json({ state: null, updatedAt: null, warning: "invalid_state" as const });
    }

    return NextResponse.json({
      state,
      updatedAt: typeof data.updated_at === "string" ? data.updated_at : null,
      summary: summarizeState(state),
    });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireAuthUserFromRequest(request);
    const supabase = await getSupabaseClientForRequest(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const rawState =
      body && typeof body === "object" && body !== null && "state" in body
        ? (body as { state: unknown }).state
        : body;

    const parsed = parsePersistedPortfolioUnknown(rawState);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid portfolio state payload." }, { status: 400 });
    }

    const { state, report: migrateReport } = prepareWorkspaceLedgerForPersist(parsed);
    const strict = isPortfolioLedgerStrictPersistEnabled();
    const validation = validateWorkspaceState(state, {
      allowLegacyAnomalies: true,
      strict,
    });

    if (strict && !validation.ok) {
      const first = validation.errors[0];
      return NextResponse.json(
        {
          ok: false,
          error: "ledger_validation_failed",
          code: first?.code ?? "INVALID_TRANSACTION_ORDER",
          portfolioId: first?.portfolioId ?? null,
          transactionId: first?.transactionId ?? null,
          message: first?.message ?? "Portfolio ledger validation failed.",
          errors: validation.errors,
          warnings: validation.warnings,
        },
        { status: 422 },
      );
    }

    if (validation.warnings.length > 0) {
      console.warn("[portfolio/workspace PUT] ledger warnings", {
        userId: user.id,
        warnings: validation.warnings.slice(0, 20),
        migrateReport,
      });
    }

    const gate = await getSubscriptionGateContext(supabase, user.id);
    if (gate.isFree && gate.maxHoldingsPerPortfolio != null) {
      const { data: existingRow } = await supabase
        .from("portfolio_workspace")
        .select("state")
        .eq("user_id", user.id)
        .maybeSingle();
      const previous = existingRow?.state
        ? parsePersistedPortfolioUnknown(existingRow.state)
        : null;
      const violation = findFreeHoldingsPersistViolation({
        portfolios: state.portfolios,
        nextHoldingsByPortfolioId: state.holdingsByPortfolioId,
        previousHoldingsByPortfolioId: previous?.holdingsByPortfolioId ?? null,
        maxHoldings: gate.maxHoldingsPerPortfolio,
      });
      if (violation) {
        return NextResponse.json(
          {
            ok: false,
            error: FREE_HOLDINGS_LIMIT_CODE,
            code: FREE_HOLDINGS_LIMIT_CODE,
            message: freeHoldingsLimitMessage(violation.max),
            portfolioId: violation.portfolioId,
            nextCount: violation.nextCount,
            prevCount: violation.prevCount,
            max: violation.max,
          },
          { status: 403 },
        );
      }
    }

    const now = new Date().toISOString();
    const { error } = await supabase.from("portfolio_workspace").upsert(
      {
        user_id: user.id,
        state,
        updated_at: now,
      },
      { onConflict: "user_id" },
    );

    if (error) {
      console.error("[portfolio/workspace PUT]", error.message);
      return NextResponse.json(
        { ok: false, warning: "db_unavailable" as const, message: error.message },
        { status: 503 },
      );
    }

    return NextResponse.json({
      ok: true,
      updatedAt: now,
      summary: summarizeState(state),
      ledgerMigrated: migrateReport.changed,
      warnings: validation.warnings.length > 0 ? validation.warnings : undefined,
    });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
