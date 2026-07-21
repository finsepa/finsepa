import { notFound } from "next/navigation";

import { Superinvestor13fProfile } from "@/components/superinvestors/superinvestor-13f-profile";
import { loadSuperinvestorProfilePageData } from "@/lib/superinvestors/load-superinvestor-profile-data";
import { parseSuperinvestorHoldingsPage } from "@/lib/superinvestors/superinvestor-holdings-page";
import { getSuperinvestorProfileDescription } from "@/lib/superinvestors/superinvestor-profile-descriptions";
import { SUPERINVESTOR_REGISTRY } from "@/lib/superinvestors/superinvestor-registry";

export async function SuperinvestorProfileBySlug({
  slug,
  holdingsPage,
}: {
  slug: string;
  holdingsPage?: string;
}) {
  const item = SUPERINVESTOR_REGISTRY.find((entry) => entry.slug === slug);
  const pageNum = parseSuperinvestorHoldingsPage(holdingsPage);
  const loaded = await loadSuperinvestorProfilePageData(slug, { holdingsPage: pageNum });
  if (!item || !loaded) notFound();

  return (
    <Superinvestor13fProfile
      profileSlug={slug}
      profileName={item.managerName}
      breadcrumbCurrentLabel={item.managerName}
      avatarSrc={item.avatarSrc}
      profileDescription={getSuperinvestorProfileDescription(slug)}
      data={loaded.comparison}
      transactions={loaded.transactions}
      allocationRows={loaded.allocationRows}
      holdingsPage={loaded.holdingsPage}
      holdingsTotalPages={loaded.holdingsTotalPages}
    />
  );
}
