import { normalizePath } from "../import/analyze";
import type { ProjectFile } from "../data/types";

const EXTERNAL_REF = /^(data:|https?:|mailto:|tel:|javascript:|blob:|#|\/\/)/i;
const TEXT_KINDS = new Set(["html", "css", "js", "other"]);

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function dataUrl(mimeType: string, buffer: ArrayBuffer): string {
  return `data:${mimeType || "application/octet-stream"};base64,${toBase64(buffer)}`;
}

export interface StandaloneOptions {
  html: string;
  mainFilePath: string;
  files: ProjectFile[];
  texts: Record<string, string>;
  fetchAsset: (path: string) => Promise<ArrayBuffer | null>;
}

/** Creates one self-contained HTML file. Every local asset becomes a data URI. */
export async function buildStandaloneHtml(options: StandaloneOptions): Promise<string> {
  const doc = new DOMParser().parseFromString(options.html, "text/html");
  const files = new Map(options.files.map((file) => [file.path, file]));
  const dataCache = new Map<string, string | null>();

  async function assetData(path: string): Promise<string | null> {
    if (dataCache.has(path)) return dataCache.get(path) ?? null;
    const file = files.get(path);
    if (!file || TEXT_KINDS.has(file.kind)) {
      dataCache.set(path, null);
      return null;
    }
    try {
      const buffer = await options.fetchAsset(path);
      if (!buffer) throw new Error("Empty asset");
      const url = dataUrl(file.mimeType, buffer);
      dataCache.set(path, url);
      return url;
    } catch {
      dataCache.set(path, null);
      return null;
    }
  }

  async function rewriteCss(css: string, basePath: string): Promise<string> {
    const pattern = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
    const matches = Array.from(css.matchAll(pattern));
    let output = "";
    let cursor = 0;
    for (const match of matches) {
      const raw = match[2];
      const start = match.index ?? 0;
      if (EXTERNAL_REF.test(raw)) continue;
      const url = await assetData(normalizePath(basePath, raw));
      if (!url) continue;
      output += css.slice(cursor, start) + `url("${url}")`;
      cursor = start + match[0].length;
    }
    return output + css.slice(cursor);
  }

  for (const link of Array.from(doc.querySelectorAll('link[rel="stylesheet"]'))) {
    const href = link.getAttribute("href") ?? "";
    if (!href || EXTERNAL_REF.test(href)) continue;
    const path = normalizePath(options.mainFilePath, href);
    const css = options.texts[path];
    if (css == null) continue;
    const style = doc.createElement("style");
    style.setAttribute("data-wis-file", path);
    style.textContent = await rewriteCss(css, path);
    link.replaceWith(style);
  }

  for (const script of Array.from(doc.querySelectorAll("script[src]"))) {
    const src = script.getAttribute("src") ?? "";
    if (!src || EXTERNAL_REF.test(src)) continue;
    const path = normalizePath(options.mainFilePath, src);
    const code = options.texts[path];
    if (code == null) continue;
    const inline = doc.createElement("script");
    inline.setAttribute("data-wis-file", path);
    inline.textContent = code;
    script.replaceWith(inline);
  }

  for (const style of Array.from(doc.querySelectorAll("style"))) {
    if (style.getAttribute("data-wis-exported")) continue;
    style.textContent = await rewriteCss(style.textContent ?? "", options.mainFilePath);
    style.setAttribute("data-wis-exported", "");
  }

  for (const element of Array.from(doc.querySelectorAll("[src], [href]"))) {
    for (const attr of ["src", "href"] as const) {
      const value = element.getAttribute(attr);
      if (!value || EXTERNAL_REF.test(value)) continue;
      if (attr === "href" && element.tagName.toLowerCase() === "a") continue;
      const path = normalizePath(options.mainFilePath, value);
      const url = await assetData(path);
      if (url) element.setAttribute(attr, url);
    }
  }

  const doctype = doc.doctype ? `<!DOCTYPE ${doc.doctype.name}>` : "<!DOCTYPE html>";
  return `${doctype}\n${doc.documentElement.outerHTML}`;
}
