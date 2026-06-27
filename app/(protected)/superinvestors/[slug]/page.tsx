import { Suspense } from "react";

import { SuperinvestorProfileBySlug } from "@/components/superinvestors/superinvestor-profile-by-slug";
import { SuperinvestorProfileSkeleton } from "@/components/superinvestors/superinvestor-profile-skeleton";
import { SUPERINVESTOR_REGISTRY } from "@/lib/superinvestors/superinvestor-registry";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return SUPERINVESTOR_REGISTRY.map((item) => ({ slug: item.slug }));
}

export default async function SuperinvestorProfilePage({ params }: PageProps) {
  const { slug } = await params;

  return (
    <Suspense fallback={<SuperinvestorProfileSkeleton />}>
      <SuperinvestorProfileBySlug slug={slug} />
    </Suspense>
  );
}
