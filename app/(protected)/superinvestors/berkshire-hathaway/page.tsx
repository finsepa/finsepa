import { Superinvestor13fProfile } from "@/components/superinvestors/superinvestor-13f-profile";
import { getBerkshireHoldingsComparison } from "@/lib/superinvestors/berkshire-13f";

export const dynamic = "force-dynamic";

const PROFILE_NAME = "Warren Buffett";
const PROFILE_AVATAR = "/superinvestors/warren-buffett.png";

export default async function BerkshireHathaway13fPage() {
  const data = await getBerkshireHoldingsComparison();

  return (
    <Superinvestor13fProfile
      profileName={PROFILE_NAME}
      breadcrumbCurrentLabel={PROFILE_NAME}
      avatarSrc={PROFILE_AVATAR}
      data={data}
    />
  );
}
