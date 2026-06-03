import { SuperinvestorProfileBySlug } from "@/components/superinvestors/superinvestor-profile-by-slug";

export const dynamic = "force-dynamic";

export default function SuperinvestorProfilePage() {
  return <SuperinvestorProfileBySlug slug="charlie-munger" />;
}
