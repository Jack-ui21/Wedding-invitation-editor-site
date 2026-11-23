import { notFound } from "next/navigation";
import { EditorClient } from "@/components/editor/EditorClient";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/data/get-store";
import { canAccessProject } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const CODE_KINDS = new Set(["html", "css", "js", "other"]);
const MAX_TEXT_BYTES = 80 * 1024 * 1024;

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const store = getStore();
  const project = await store.getProject(id);
  if (!project || !canAccessProject(user, project)) notFound();

  const fileUrls: Record<string, string> = {};
  const texts: Record<string, string> = {};
  for (const file of project.files) {
    try {
      fileUrls[file.path] = await store.getFileUrl(id, file.path);
    } catch {
      fileUrls[file.path] = `/api/files/${id}/${file.path.split("/").map(encodeURIComponent).join("/")}`;
    }
    if (CODE_KINDS.has(file.kind) && file.size <= MAX_TEXT_BYTES) {
      try {
        const bytes = await store.getFile(id, file.path);
        if (bytes) texts[file.path] = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      } catch {
        // A missing text file is handled by the editor as an empty file.
      }
    }
  }
  const mainBytes = await store.getFile(id, project.mainFilePath);
  const source = mainBytes ? new TextDecoder("utf-8", { fatal: false }).decode(mainBytes) : "";
  if (source) texts[project.mainFilePath] = source;

  return (
    <EditorClient
      project={project}
      initialTexts={texts}
      fileUrls={fileUrls}
      isOwner={user.role === "owner"}
    />
  );
}
