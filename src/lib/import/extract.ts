import { mimeForPath } from "../data/path";
import type { ImportedFile } from "./types";

const SCRIPT_TYPES = new Set(["", "text/javascript", "application/javascript", "module", "text/ecmascript"]);

function textFile(path: string, text: string): ImportedFile {
  return {
    path,
    name: path.split("/").pop() ?? path,
    kind: path.endsWith(".css") ? "css" : "js",
    mimeType: mimeForPath(path),
    size: new TextEncoder().encode(text).byteLength,
    text,
  };
}

/** Move inline <style>/<script> blocks into real project files, preserving order and behaviour. */
export function extractInlineAssets(
  html: string,
  mainPath: string,
  parsedDocument?: Document,
): { html: string; files: ImportedFile[] } {
  const doc = parsedDocument ?? new DOMParser().parseFromString(html, "text/html");
  const files: ImportedFile[] = [];

  let styleIndex = 0;
  for (const style of Array.from(doc.querySelectorAll("style"))) {
    const css = style.textContent ?? "";
    if (!css.trim()) continue;
    styleIndex += 1;
    const path = `styles/inline-${styleIndex}.css`;
    files.push(textFile(path, css));
    const link = doc.createElement("link");
    link.setAttribute("rel", "stylesheet");
    link.setAttribute("href", path);
    style.replaceWith(link);
  }

  let scriptIndex = 0;
  for (const script of Array.from(doc.querySelectorAll("script:not([src])"))) {
    const type = (script.getAttribute("type") ?? "").toLowerCase();
    if (!SCRIPT_TYPES.has(type)) continue;
    const code = script.textContent ?? "";
    if (!code.trim()) continue;
    scriptIndex += 1;
    const path = `scripts/inline-${scriptIndex}.js`;
    files.push(textFile(path, code));
    const replacement = doc.createElement("script");
    if (type && type !== "text/javascript") replacement.setAttribute("type", type);
    replacement.setAttribute("src", path);
    script.replaceWith(replacement);
  }

  const doctype = doc.doctype ? `<!DOCTYPE ${doc.doctype.name}>` : "<!DOCTYPE html>";
  return { html: `${doctype}\n${doc.documentElement.outerHTML}`, files };
}
