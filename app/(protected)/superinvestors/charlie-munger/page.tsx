import { Superinvestor13fProfile } from "@/components/superinvestors/superinvestor-13f-profile";
import { getDailyJournalHoldingsComparison } from "@/lib/superinvestors/berkshire-13f";

export const dynamic = "force-dynamic";

export default async function CharlieMunger13fPage() {
  const data = await getDailyJournalHoldingsComparison();

  return (
    <Superinvestor13fProfile
      profileName="Charlie Munger"
      breadcrumbCurrentLabel="Charlie Munger"
      avatarSrc="/superinvestors/charlie-munger.png"
      data={data}
    />
  );
}
