import { Superinvestor13fProfile } from "@/components/superinvestors/superinvestor-13f-profile";
import { getFisherHoldingsComparison } from "@/lib/superinvestors/berkshire-13f";

export const dynamic = "force-dynamic";

export default async function KenFisher13fPage() {
  const data = await getFisherHoldingsComparison();

  return (
    <Superinvestor13fProfile
      profileName="Ken Fisher"
      breadcrumbCurrentLabel="Ken Fisher"
      avatarSrc={null}
      data={data}
    />
  );
}

