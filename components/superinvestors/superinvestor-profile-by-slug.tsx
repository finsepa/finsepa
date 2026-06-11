import { notFound } from "next/navigation";

import { Superinvestor13fProfile } from "@/components/superinvestors/superinvestor-13f-profile";
import { loadSuperinvestorProfilePageData } from "@/lib/superinvestors/load-superinvestor-profile-data";
import { getSuperinvestorProfileDescription } from "@/lib/superinvestors/superinvestor-profile-descriptions";
import { SUPERINVESTOR_REGISTRY } from "@/lib/superinvestors/superinvestor-registry";

export async function SuperinvestorProfileBySlug({ slug }: { slug: string }) {
  const item = SUPERINVESTOR_REGISTRY.find((entry) => entry.slug === slug);
  const loaded = await loadSuperinvestorProfilePageData(slug);
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
    />
  );
}
