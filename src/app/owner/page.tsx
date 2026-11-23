import { redirect } from "next/navigation";
import { OwnerDashboard } from "@/components/dashboards/OwnerDashboard";
import { requireOwner } from "@/lib/auth";
import { getStore } from "@/lib/data/get-store";

export const dynamic = "force-dynamic";

export default async function OwnerPage() {
  const user = await requireOwner();
  const store = getStore();
  const [projects, customers, templates] = await Promise.all([store.listProjects(), store.listCustomers(), store.listTemplates()]);
  if (!customers.some((customer) => customer.userId === user.id)) {
    // Owner accounts also get a customer profile so projects can always be assigned.
    await store.createCustomer({ userId: user.id, name: user.name || "Studio Owner", email: user.email, phone: "" });
    redirect("/owner");
  }
  return <OwnerDashboard user={user} projects={projects} customers={customers} templates={templates} />;
}
