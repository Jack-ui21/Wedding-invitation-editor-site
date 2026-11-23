import { createClient } from "@supabase/supabase-js";
import { PUBLIC_DATA_DRIVER, STORAGE_BUCKET } from "../config";
import { apiFetch } from "../client-fetch";
import type { ImportedFile } from "../import/types";
import type { ProjectFile } from "../data/types";

export interface UploadedFile {
  file: ProjectFile;
  url: string;
}

export function fileBytes(file: ImportedFile): Uint8Array {
  return file.bytes ?? new TextEncoder().encode(file.text ?? "");
}

/** Production uploads go straight to Supabase Storage, bypassing Vercel's 4.5 MB function body limit. */
export async function uploadProjectFile(
  projectId: string,
  file: ImportedFile,
  onProgress?: (percent: number) => void,
): Promise<UploadedFile> {
  const bytes = fileBytes(file);
  onProgress?.(10);
  if (PUBLIC_DATA_DRIVER === "supabase") {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) throw new Error("Supabase Storage is not configured");
    const supabase = createClient(url, anon);
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(`${projectId}/${file.path}`, bytes, { contentType: file.mimeType, upsert: true });
    if (error) throw new Error(error.message);
    onProgress?.(80);
    const result = await apiFetch<UploadedFile>(`/api/projects/${projectId}/files`, {
      method: "PATCH",
      body: JSON.stringify({
        path: file.path,
        name: file.name,
        mimeType: file.mimeType,
        size: bytes.byteLength,
        isAsset: file.isAsset ?? false,
      }),
    });
    onProgress?.(100);
    return result;
  }

  const response = await fetch(`/api/projects/${projectId}/files`, {
    method: "POST",
    headers: { "x-file-path": file.path, "x-content-type": file.mimeType },
    body: new Blob([new Uint8Array(bytes)]),
  });
  const result = (await response.json()) as UploadedFile & { error?: string };
  if (!response.ok || !result.file) throw new Error(result.error ?? "Upload failed");
  const url = result.url || `/api/files/${projectId}/${file.path.split("/").map(encodeURIComponent).join("/")}`;
  onProgress?.(100);
  return { file: result.file, url };
}

export async function deleteProjectFile(projectId: string, path: string): Promise<void> {
  await apiFetch(`/api/projects/${projectId}/files`, { method: "DELETE", body: JSON.stringify({ path }) });
}
