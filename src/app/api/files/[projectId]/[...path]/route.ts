import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getStore } from "@/lib/data/get-store";
import { detectFileKind, mimeForPath, safeRelativePath } from "@/lib/data/path";
import { canAccessProject } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ projectId: string; path: string[] }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const { projectId, path } = await params;
    const relative = safeRelativePath(path.join("/"));
    const store = getStore();
    const project = await store.getProject(projectId);
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const user = await getSessionUser();
    if (project.status !== "published" && (!user || !canAccessProject(user, project))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const bytes = await store.getFile(projectId, relative);
    if (!bytes) return NextResponse.json({ error: "File not found" }, { status: 404 });
    const kind = detectFileKind(relative);
    const contentType = kind === "html" || kind === "js" ? "text/plain; charset=utf-8" : mimeForPath(relative);
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Length": String(bytes.byteLength),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": project.status === "published" ? "public, max-age=3600" : "private, no-store",
    };
    if (kind === "html") headers["Content-Disposition"] = "attachment";
    return new Response(new Uint8Array(bytes), { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not read file" }, { status: 400 });
  }
}
