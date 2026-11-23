import { CustomersPageClient } from "@/components/dashboards/AdminLists";
import { requireOwner } from "@/lib/auth";
import { getStore } from "@/lib/data/get-store";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const user = await requireOwner();
  const store = getStore();
  const [customers, users, projects] = await Promise.all([store.listCustomers(), store.listUsers(), store.listProjects()]);
  return (
    <CustomersPageClient
      user={user}
      customers={customers.map((customer) => ({
        ...customer,
        userName: users.find((item) => item.id === customer.userId)?.name ?? "",
        projectCount: projects.filter((project) => project.customerId === customer.id).length,
      }))}
    />
  );
}
