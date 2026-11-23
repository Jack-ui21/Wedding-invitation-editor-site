import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getStore } from "@/lib/data/get-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const store = getStore();
    const projects = await store.listProjects(
      user.role === "owner" ? undefined : { customerId: user.customerId ?? "" },
    );
    return NextResponse.json({ projects });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load projects" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (user?.role !== "owner") return NextResponse.json({ error: "Owner access required" }, { status: 403 });
    const body = (await request.json()) as { customerId?: string; name?: string; templateId?: string | null };
    if (!body.customerId || !body.name?.trim()) {
      return NextResponse.json({ error: "Customer and project name are required" }, { status: 400 });
    }
    const store = getStore();
    const customer = await store.getCustomerById(body.customerId);
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    const template = body.templateId
      ? (await store.listTemplates()).find((item) => item.id === body.templateId) ?? null
      : null;
    if (body.templateId && !template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    let project;
    if (template?.sourceProjectId && await store.getProject(template.sourceProjectId)) {
      // A template is backed by a real project: copy its source files, mappings and wedding data.
      const copy = await store.duplicateProject(template.sourceProjectId, body.name.trim());
      project = await store.updateProject(copy.id, {
        customerId: customer.id,
        ownerId: user.id,
        templateId: template.id,
        status: "draft",
        slug: null,
        publishedUrl: null,
      });
    } else {
      project = await store.createProject({
        customerId: customer.id,
        ownerId: user.id,
        name: body.name,
        templateId: template?.id ?? null,
      });
    }
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create project" }, { status: 400 });
  }
}
