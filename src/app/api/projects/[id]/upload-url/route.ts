import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { safeRelativePath } from "@/lib/data/path";
import { getStore } from "@/lib/data/get-store";
import { canEditProject } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** Issues a short-lived signed URL for direct-to-Storage uploads. */
export async function POST(request: Request, { params }: Context) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const { id } = await params;
    const store = getStore();
    const project = await store.getProject(id);
    if (!project || !canEditProject(user, project)) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const body = (await request.json()) as { path?: string };
    if (!body?.path) return NextResponse.json({ error: "File path is required" }, { status: 400 });
    const path = safeRelativePath(body.path);
    const signed = await store.createSignedUploadUrl(id, path);
    return NextResponse.json(signed);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create upload URL" }, { status: 400 });
  }
}
