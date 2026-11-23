import { NextResponse } from "next/server";
import { JSDOM } from "jsdom";
import { buildPreviewDocument } from "@/lib/editor/source";
import { getStore } from "@/lib/data/get-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEXT_KINDS = new Set(["html", "css", "js", "other"]);
const CSP = [
  "default-src 'self' data: https: blob:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob:",
  "style-src 'self' 'unsafe-inline' https:",
  "img-src 'self' data: https: blob:",
  "media-src 'self' data: https: blob:",
  "font-src 'self' data: https:",
  "connect-src 'self' https:",
  "frame-src 'self' https:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

function ensureDomParser(): void {
  const globalWithDom = globalThis as unknown as { DOMParser?: typeof DOMParser };
  if (globalWithDom.DOMParser) return;
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  globalWithDom.DOMParser = dom.window.DOMParser as unknown as typeof DOMParser;
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = getStore();
  try {
    const project = await store.getPublishedProject(slug);
    if (!project) return new NextResponse("Invitation not found", { status: 404 });

    const mainBytes = await store.getFile(project.id, project.mainFilePath);
    if (!mainBytes) return new NextResponse("Invitation source is missing", { status: 404 });
    const html = new TextDecoder("utf-8", { fatal: false }).decode(mainBytes);

    const files = [] as Array<{ path: string; text?: string; url: string }>;
    for (const file of project.files) {
      let url: string;
      try {
        url = await store.getFileUrl(project.id, file.path);
      } catch {
        url = `/api/files/${project.id}/${file.path.split("/").map(encodeURIComponent).join("/")}`;
      }
      let text: string | undefined;
      if (TEXT_KINDS.has(file.kind) && file.size <= 80 * 1024 * 1024) {
        const bytes = await store.getFile(project.id, file.path);
        if (bytes) text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      }
      files.push({ path: file.path, text, url });
    }
    ensureDomParser();
    const document = buildPreviewDocument({
      html,
      mainFilePath: project.mainFilePath,
      files,
      details: project.wedding,
      mappings: project.fieldMappings,
      events: project.events,
      token: "",
      selectMode: false,
      publicMode: true,
    });

    return new NextResponse(document, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=60, must-revalidate",
        "Content-Security-Policy": CSP,
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
    });
  } catch (error) {
    console.error("Published page failed", error);
    return new NextResponse("Invitation could not be loaded", { status: 500 });
  }
}
