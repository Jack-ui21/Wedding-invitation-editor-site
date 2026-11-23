import { NextResponse } from "next/server";
import { MAX_IMPORT_BYTES } from "@/lib/config";
import { getSessionUser } from "@/lib/auth";
import { detectFileKind, mimeForPath, safeRelativePath } from "@/lib/data/path";
import { getStore } from "@/lib/data/get-store";
import type { ProjectFile } from "@/lib/data/types";
import { canEditProject } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

async function authorize(id: string) {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in required", status: 401 } as const;
  const store = getStore();
  const project = await store.getProject(id);
  if (!project || !canEditProject(user, project)) return { error: "Project not found", status: 404 } as const;
  return { store } as const;
}

export async function POST(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const auth = await authorize(id);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const filePath = request.headers.get("x-file-path") ?? "";
    const safe = safeRelativePath(filePath);
    const kind = detectFileKind(safe);
    if (!["html", "css", "js", "image", "audio", "font", "other"].includes(kind)) {
      return NextResponse.json({ error: "This file type is not allowed" }, { status: 400 });
    }
    const bytes = Buffer.from(await request.arrayBuffer());
    if (!bytes.byteLength) return NextResponse.json({ error: "The file is empty" }, { status: 400 });
    if (bytes.byteLength > MAX_IMPORT_BYTES) return NextResponse.json({ error: "File exceeds the 120 MB limit" }, { status: 413 });
    const mime = request.headers.get("x-content-type") || mimeForPath(safe);
    const file = await auth.store.putFile(id, safe, bytes, mime, { isAsset: ["image", "audio", "font"].includes(kind) });
    const url = await auth.store.getFileUrl(id, safe);
    return NextResponse.json({ file, url }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const auth = await authorize(id);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { path } = (await request.json()) as { path?: string };
    if (!path) return NextResponse.json({ error: "File path is required" }, { status: 400 });
    await auth.store.deleteFile(id, safeRelativePath(path));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Delete failed" }, { status: 400 });
  }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const auth = await authorize(id);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = (await request.json()) as ProjectFile;
    if (!body?.path) return NextResponse.json({ error: "File metadata is required" }, { status: 400 });
    const safe = safeRelativePath(body.path);
    const file: ProjectFile = {
      path: safe,
      name: body.name || safe.split("/").pop() || safe,
      kind: detectFileKind(safe),
      mimeType: body.mimeType || mimeForPath(safe),
      size: Number(body.size) || 0,
      isAsset: Boolean(body.isAsset),
    };
    await auth.store.registerFile(id, file);
    const url = await auth.store.getFileUrl(id, safe);
    return NextResponse.json({ file, url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Metadata update failed" }, { status: 400 });
  }
}
