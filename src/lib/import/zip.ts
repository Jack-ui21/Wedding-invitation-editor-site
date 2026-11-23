import JSZip from "jszip";
import { MAX_IMPORT_BYTES, MAX_ASSET_BYTES } from "../config";
import { detectFileKind, mimeForPath, safeRelativePath } from "../data/path";
import { countDataUris, detectAssetReferences, detectFields, normalizePath } from "./analyze";
import { extractInlineAssets } from "./extract";
import type { ImportedFile, ImportResult } from "./types";

const IGNORED = /(__MACOSX|\.DS_Store|Thumbs\.db|^\.)/i;
const UNSAFE_EXT = /\.(exe|dll|so|dylib|bat|cmd|sh|php|phtml|jsp|asp|exe?|msi|app)$/i;
const TEXT_KINDS = new Set(["html", "css", "js", "json", "other"]);

/** Safely extracts a ZIP website project. Rejects traversal and executable entries. */
export async function importZip(
  file: File,
  onProgress?: (percent: number, phase: string) => void,
  preferredMain?: string,
): Promise<ImportResult> {
  if (!/\.zip$/i.test(file.name)) throw new Error("Please choose a .zip file");
  if (file.size > MAX_IMPORT_BYTES) throw new Error(`ZIP is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_IMPORT_BYTES / 1024 / 1024} MB.`);

  onProgress?.(5, "Reading ZIP archive");
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file, { checkCRC32: true });
  } catch (error) {
    throw new Error(`Could not open ZIP: ${error instanceof Error ? error.message : "invalid archive"}`);
  }

  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  const files: ImportedFile[] = [];
  const warnings: string[] = [];
  let total = 0;

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const name = entry.name;
    if (IGNORED.test(name.split("/").pop() ?? name)) continue;
    if ((entry as unknown as { encrypted?: boolean }).encrypted) {
      warnings.push(`Skipped password-protected file: ${name}`);
      continue;
    }
    if (UNSAFE_EXT.test(name)) {
      warnings.push(`Skipped unsupported/executable file: ${name}`);
      continue;
    }
    let relative: string;
    try {
      relative = safeRelativePath(name);
    } catch {
      warnings.push(`Skipped file with unsafe path: ${name}`);
      continue;
    }
    const bytes = await entry.async("uint8array");
    total += bytes.byteLength;
    if (total > MAX_IMPORT_BYTES) throw new Error("The uncompressed ZIP exceeds the 120 MB project limit");
    if (bytes.byteLength > MAX_ASSET_BYTES && detectFileKind(relative) !== "html") {
      warnings.push(`Large file included: ${relative} (${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB)`);
    }
    const kind = detectFileKind(relative);
    const imported: ImportedFile = {
      path: relative,
      name: relative.split("/").pop() ?? relative,
      kind,
      mimeType: mimeForPath(relative),
      size: bytes.byteLength,
      bytes,
      isAsset: ["image", "audio", "font"].includes(kind),
    };
    if (TEXT_KINDS.has(kind)) imported.text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    files.push(imported);
    onProgress?.(5 + Math.round(((index + 1) / entries.length) * 65), `Extracting ${imported.name}`);
  }

  const htmlCandidates = files
    .filter((file) => file.kind === "html")
    .sort((a, b) => {
      const score = (path: string) => (path.toLowerCase() === "index.html" ? 0 : path.toLowerCase().endsWith("/index.html") ? 1 : path.split("/").length);
      return score(a.path) - score(b.path) || a.path.localeCompare(b.path);
    })
    .map((file) => file.path);

  if (!htmlCandidates.length) throw new Error("No HTML file was found in the ZIP");
  const mainPath = htmlCandidates.includes(preferredMain ?? "") ? preferredMain! : htmlCandidates[0];
  const main = files.find((file) => file.path === mainPath)!;
  const source = main.text ?? new TextDecoder().decode(main.bytes ?? new Uint8Array());
  const doc = new DOMParser().parseFromString(source, "text/html");
  if (!doc.querySelector("body")) throw new Error("The main HTML file is not a valid document");

  const fields = detectFields(doc);
  const refs = detectAssetReferences(doc, mainPath);
  const dataUriCount = countDataUris(source);
  const extracted = extractInlineAssets(source, mainPath, doc);
  main.text = extracted.html;
  main.bytes = new TextEncoder().encode(extracted.html);
  main.size = main.bytes.byteLength;

  const knownPaths = new Set(files.map((file) => file.path));
  const missing = refs.filter((ref) => !knownPaths.has(ref.path) && !ref.dataUri);
  if (missing.length) warnings.push(`${missing.length} referenced asset(s) are missing from the ZIP: ${missing.slice(0, 5).map((ref) => ref.path).join(", ")}${missing.length > 5 ? "…" : ""}`);
  if (htmlCandidates.length > 1) warnings.push(`Multiple HTML files found. Using ${mainPath}. You can choose another file before importing.`);
  if (dataUriCount) warnings.push(`${dataUriCount} embedded data-URI image(s) were preserved.`);
  if (!fields.length) warnings.push("No standard fields detected. Use manual element mapping in the editor.");

  onProgress?.(95, "Analysing website");
  return {
    mainFilePath: mainPath,
    html: extracted.html,
    files: [...files, ...extracted.files],
    fields,
    htmlCandidates,
    warnings,
    dataUriCount,
  };
}
