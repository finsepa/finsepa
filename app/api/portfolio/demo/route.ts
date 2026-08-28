import { NextResponse } from "next/server";

import {
  FREE_HOLDINGS_LIMIT_CODE,
  findFreeHoldingsPersistViolation,
  freeHoldingsLimitMessage,
} from "@/lib/account/free-plan-asset-limits";
import { getSubscriptionGateContext } from "@/lib/account/subscription-gate";
import { requireAuthUserFromRequest, AuthRequiredError } from "@/lib/watchlist/api-auth";
import { isPortfolioLedgerStrictPersistEnabled } from "@/lib/features/portfolio-correctness";
import { prepareWorkspaceLedgerForPersist } from "@/lib/portfolio/ledger/portfolio-ledger-prepare";
import { validateWorkspaceState } from "@/lib/portfolio/ledger/portfolio-ledger-validate";
import {
  parsePersistedPortfolioUnknown,
  type PersistedPortfolioState,
} from "@/lib/portfolio/portfolio-storage";
import { seedDemoPortfolioInWorkspace } from "@/lib/portfolio/seed-demo-portfolio-workspace";
import { getSupabaseClientForRequest } from "@/lib/supabase/request-client";

/** Auth: Bearer or cookie — seeds the single Free demo portfolio (web `openTryDemoPortfolio`). */
export async function POST(request: Request) {
  try {
    const user = await requireAuthUserFromRequest(request);
    const supabase = await getSupabaseClientForRequest(request);

    let convertPortfolioId: string | null = null;
    try {
      const body = (await request.json()) as { portfolioId?: unknown };
      if (typeof body.portfolioId === "string" && body.portfolioId.trim()) {
        convertPortfolioId = body.portfolioId.trim();
      }
    } catch {
      /* empty body ok */
    }

    const { data: existingRow, error: readError } = await supabase
      .from("portfolio_workspace")
      .select("state")
      .eq("user_id", user.id)
      .maybeSingle();

    if (readError) {
      console.error("[portfolio/demo POST] read", readError.message);
      return NextResponse.json({ error: "Could not load portfolio workspace." }, { status: 503 });
    }

    const previous = existingRow?.state
      ? parsePersistedPortfolioUnknown(existingRow.state)
      : null;

    const seeded = seedDemoPortfolioInWorkspace(previous, { convertPortfolioId });

    if ("alreadyExists" in seeded && seeded.alreadyExists) {
      return NextResponse.json({
        ok: true,
        portfolioId: seeded.portfolioId,
        created: false,
        converted: false,
        message: "Demo portfolio is already in your list.",
      });
    }

    const { state: prepared, report: migrateReport } = prepareWorkspaceLedgerForPersist(seeded.state);
    const strict = isPortfolioLedgerStrictPersistEnabled();
    const validation = validateWorkspaceState(prepared, {
      allowLegacyAnomalies: true,
      strict,
    });

    if (strict && !validation.ok) {
      const first = validation.errors[0];
      return NextResponse.json(
        {
          ok: false,
          error: "ledger_validation_failed",
          message: first?.message ?? "Portfolio ledger validation failed.",
        },
        { status: 422 },
      );
    }

    const gate = await getSubscriptionGateContext(supabase, user.id);
    if (gate.isFree && gate.maxHoldingsPerPortfolio != null) {
      const violation = findFreeHoldingsPersistViolation({
        portfolios: prepared.portfolios,
        nextHoldingsByPortfolioId: prepared.holdingsByPortfolioId,
        previousHoldingsByPortfolioId: previous?.holdingsByPortfolioId ?? null,
        maxHoldings: gate.maxHoldingsPerPortfolio,
      });
      if (violation) {
        return NextResponse.json(
          {
            ok: false,
            error: FREE_HOLDINGS_LIMIT_CODE,
            message: freeHoldingsLimitMessage(violation.max),
          },
          { status: 403 },
        );
      }
    }

    const now = new Date().toISOString();
    const { error: writeError } = await supabase.from("portfolio_workspace").upsert(
      {
        user_id: user.id,
        state: prepared satisfies PersistedPortfolioState,
        updated_at: now,
      },
      { onConflict: "user_id" },
    );

    if (writeError) {
      console.error("[portfolio/demo POST] write", writeError.message);
      return NextResponse.json({ error: "Could not save demo portfolio." }, { status: 503 });
    }

    if (validation.warnings.length > 0 || migrateReport.changed) {
      console.info("[portfolio/demo POST] persisted", {
        userId: user.id,
        portfolioId: seeded.portfolioId,
        migrated: migrateReport.changed,
        warnings: validation.warnings.length,
      });
    }

    const converted = "converted" in seeded ? seeded.converted : false;
    const message =
      converted
        ? "Sample holdings loaded — explore anytime."
      : "Finsepa Demo added — explore sample holdings anytime.";

    return NextResponse.json({
      ok: true,
      portfolioId: seeded.portfolioId,
      created: true,
      converted,
      message,
    });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
