import { TemplatesPageClient } from "@/components/dashboards/AdminLists";
import { requireOwner } from "@/lib/auth";
import { getStore } from "@/lib/data/get-store";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const user = await requireOwner();
  const store = getStore();
  const [templates, projects] = await Promise.all([store.listTemplates(), store.listProjects()]);
  return <TemplatesPageClient user={user} templates={templates} projects={projects} />;
}
