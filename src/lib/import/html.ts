import { mimeForPath } from "../data/path";
import { MAX_IMPORT_BYTES } from "../config";
import { countDataUris, detectAssetReferences, detectFields } from "./analyze";
import { extractInlineAssets } from "./extract";
import type { ImportResult, ImportedFile } from "./types";

export function importHtml(fileName: string, html: string): ImportResult {
  const size = new TextEncoder().encode(html).byteLength;
  if (!/\.html?$/i.test(fileName)) throw new Error("Please choose an .html or .htm file");
  if (size > MAX_IMPORT_BYTES) throw new Error(`HTML file is too large (${(size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_IMPORT_BYTES / 1024 / 1024} MB.`);

  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc.querySelector("html") || !doc.querySelector("body")) throw new Error("The file does not look like a valid HTML document");
  const fields = detectFields(doc);
  const refs = detectAssetReferences(doc, "index.html");
  const dataUriCount = countDataUris(html);
  const extracted = extractInlineAssets(html, "index.html", doc);

  const main: ImportedFile = {
    path: "index.html",
    name: "index.html",
    kind: "html",
    mimeType: mimeForPath("index.html"),
    size: new TextEncoder().encode(extracted.html).byteLength,
    text: extracted.html,
  };

  const warnings: string[] = [];
  if (refs.length) {
    warnings.push(`${refs.length} local asset reference(s) were detected. Import a ZIP project to include those files.`);
  }
  if (dataUriCount) {
    warnings.push(`${dataUriCount} embedded data-URI image(s) were preserved in the HTML.`);
  }
  if (!fields.length) {
    warnings.push("No standard wedding fields were detected automatically. Use 'Pick from preview' in the editor to map fields manually.");
  }

  return {
    mainFilePath: "index.html",
    html: extracted.html,
    files: [main, ...extracted.files],
    fields,
    htmlCandidates: ["index.html"],
    warnings,
    dataUriCount,
  };
}
