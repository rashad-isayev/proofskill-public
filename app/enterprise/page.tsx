import { requireExperience } from "@/lib/auth/server";
import { HRDashboard } from "@/components/b2b/dashboard";
export const metadata = { title: "Hiring overview" };
export default async function Page() {
  await requireExperience("enterprise", "/enterprise");
  return <HRDashboard />;
}
