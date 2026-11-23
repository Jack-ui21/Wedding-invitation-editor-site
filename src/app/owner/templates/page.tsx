import { TemplatesPageClient } from "@/components/dashboards/AdminLists";
import { requireOwner } from "@/lib/auth";
import { getStore } from "@/lib/data/get-store";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const user = await requireOwner();
  const templates = await getStore().listTemplates();
  return <TemplatesPageClient user={user} templates={templates} />;
}
