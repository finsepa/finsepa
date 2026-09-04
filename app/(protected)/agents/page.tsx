"use client";

import { useRouter } from "next/navigation";

import { usePlanAccessOptional } from "@/components/account/plan-access-provider";
import { AgentChatPage } from "@/components/agents/agent-chat-page";
import { accentFillButtonClassName } from "@/components/design-system/secondary-button-styles";
import { EmptyMedia } from "@/components/ui/empty";
import { PATH_ACCOUNT_PLANS } from "@/lib/auth/routes";
import { Lock } from "@/lib/icons";
import { cn } from "@/lib/utils";

export default function AgentPage() {
  const plan = usePlanAccessOptional();
  const router = useRouter();

  if (plan && !plan.canUseAgent) {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col items-center justify-center px-6">
        <div className="flex max-w-sm flex-col items-center text-center">
          <EmptyMedia variant="icon" className="mb-4 rounded-full bg-accent/10 text-accent">
            <Lock className="h-6 w-6" strokeWidth={1.75} aria-hidden />
          </EmptyMedia>
          <h1 className="text-xl font-semibold tracking-tight text-fg">Upgrade to access agent</h1>
          <p className="mt-2 text-sm leading-5 text-fg-muted">
            AI Agent is available on Pro. Ask about your portfolio, watchlist, and markets.
          </p>
          <button
            type="button"
            className={cn(accentFillButtonClassName, "mt-6")}
            onClick={() => router.push(PATH_ACCOUNT_PLANS)}
          >
            Get Pro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <AgentChatPage />
    </div>
  );
}
