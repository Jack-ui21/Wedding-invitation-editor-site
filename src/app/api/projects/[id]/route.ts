import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getStore } from "@/lib/data/get-store";
import type { ProjectPatch } from "@/lib/data/types";
import { allowedProjectPatch, canAccessProject, canEditProject } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const { id } = await params;
    const store = getStore();
    const project = await store.getProject(id);
    if (!project || !canAccessProject(user, project)) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json({ project });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Load failed" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const { id } = await params;
    const store = getStore();
    const project = await store.getProject(id);
    if (!project || !canEditProject(user, project)) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const permitted = allowedProjectPatch(user, body) as ProjectPatch;
    if (!Object.keys(permitted).length) {
      return NextResponse.json({ error: "No editable fields supplied" }, { status: 400 });
    }
    const updated = await store.updateProject(id, permitted);
    return NextResponse.json({ project: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Save failed" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const user = await getSessionUser();
    if (user?.role !== "owner") return NextResponse.json({ error: "Owner access required" }, { status: 403 });
    const { id } = await params;
    await getStore().deleteProject(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Delete failed" }, { status: 400 });
  }
}
