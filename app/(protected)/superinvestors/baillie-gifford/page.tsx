import { Superinvestor13fProfile } from "@/components/superinvestors/superinvestor-13f-profile";
import { getBaillieGiffordHoldingsComparison } from "@/lib/superinvestors/berkshire-13f";

export const dynamic = "force-dynamic";

export default async function BaillieGifford13fPage() {
  const data = await getBaillieGiffordHoldingsComparison();

  return (
    <Superinvestor13fProfile
      profileName="Baillie Gifford"
      breadcrumbCurrentLabel="Baillie Gifford"
      avatarSrc={null}
      data={data}
    />
  );
}
