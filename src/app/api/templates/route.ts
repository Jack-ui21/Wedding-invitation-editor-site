import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getStore } from "@/lib/data/get-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  return NextResponse.json({ templates: await getStore().listTemplates() });
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (user?.role !== "owner") return NextResponse.json({ error: "Owner access required" }, { status: 403 });
    const body = (await request.json()) as { name?: string; description?: string; sourceProjectId?: string | null };
    if (!body.name?.trim()) return NextResponse.json({ error: "Template name is required" }, { status: 400 });
    const template = await getStore().createTemplate({
      name: body.name.trim(),
      description: body.description?.trim() ?? "",
      thumbnailPath: "",
      sourceProjectId: body.sourceProjectId ?? null,
    });
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create template" }, { status: 400 });
  }
}
