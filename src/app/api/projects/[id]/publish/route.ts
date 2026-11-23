import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/config";
import { getSessionUser } from "@/lib/auth";
import { getStore } from "@/lib/data/get-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (user?.role !== "owner") return NextResponse.json({ error: "Owner access required" }, { status: 403 });
    const { id } = await params;
    const store = getStore();
    const project = await store.getProject(id);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const body = (await request.json()) as { publish?: boolean; slug?: string };

    if (body.publish === false) {
      const updated = await store.updateProject(id, { status: "ready_for_review", publishedUrl: null });
      return NextResponse.json({ project: updated });
    }

    const slug = (body.slug ?? project.slug ?? "").trim().toLowerCase();
    if (!SLUG.test(slug)) {
      return NextResponse.json({ error: "Slug must be 3–60 lowercase letters, numbers or hyphens" }, { status: 400 });
    }
    if (await store.slugTaken(slug, id)) {
      return NextResponse.json({ error: "This slug is already used by another project" }, { status: 409 });
    }
    if (!project.files.some((file) => file.kind === "html")) {
      return NextResponse.json({ error: "Import or create an HTML page before publishing" }, { status: 400 });
    }
    const updated = await store.updateProject(id, {
      slug,
      status: "published",
      publishedUrl: `${SITE_URL.replace(/\/$/, "")}/w/${slug}`,
    });
    return NextResponse.json({ project: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Publish failed" }, { status: 400 });
  }
}
