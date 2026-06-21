import { notFound } from "next/navigation";

import { OpsHealthClient } from "@/app/ops/[slug]/ops-health-client";
import { adminHealthSlugMatches, hasValidAdminHealthSession } from "@/lib/admin-health/auth";
import { isAdminHealthConfigured } from "@/lib/admin-health/env";
import { runAdminHealthChecks } from "@/lib/admin-health/run-checks";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function OpsHealthPage({ params }: Props) {
  if (!isAdminHealthConfigured()) {
    notFound();
  }

  const { slug } = await params;
  if (!adminHealthSlugMatches(slug)) {
    notFound();
  }

  const authenticated = await hasValidAdminHealthSession(slug);
  const initialReport = authenticated ? await runAdminHealthChecks() : null;

  return (
    <OpsHealthClient slug={slug} authenticated={authenticated} initialReport={initialReport} />
  );
}
