import { redirect } from "next/navigation";
import { CustomerDashboard } from "@/components/dashboards/CustomerDashboard";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data/get-store";

export const dynamic = "force-dynamic";

export default async function CustomerDashboardPage() {
  const user = await requireUser();
  if (user.role === "owner") redirect("/owner");
  const projects = await getStore().listProjects({ customerId: user.customerId ?? "" });
  return <CustomerDashboard user={user} projects={projects} />;
}
