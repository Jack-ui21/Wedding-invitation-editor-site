import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getStore } from "@/lib/data/get-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (user?.role !== "owner") return NextResponse.json({ error: "Owner access required" }, { status: 403 });
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { name?: string };
    const store = getStore();
    const source = await store.getProject(id);
    if (!source) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const copy = await store.duplicateProject(id, body.name?.trim() || `${source.name} (copy)`);
    return NextResponse.json({ project: copy }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Duplicate failed" }, { status: 400 });
  }
}
