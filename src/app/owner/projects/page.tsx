import { OwnerDashboard } from "@/components/dashboards/OwnerDashboard";
import { requireOwner } from "@/lib/auth";
import { getStore } from "@/lib/data/get-store";

export const dynamic = "force-dynamic";

export default async function OwnerProjectsPage() {
  const user = await requireOwner();
  const store = getStore();
  const [projects, customers, templates] = await Promise.all([store.listProjects(), store.listCustomers(), store.listTemplates()]);
  return <OwnerDashboard user={user} projects={projects} customers={customers} templates={templates} />;
}
