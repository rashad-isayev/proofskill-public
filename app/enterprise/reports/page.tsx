import { requireExperience } from "@/lib/auth/server";
import { HRCatalog } from "@/components/b2b/catalog";
export const metadata = { title: "Reports" };
export default async function Page() {
  await requireExperience("enterprise", "/enterprise/reports");
  return <HRCatalog mode="reports" />;
}
