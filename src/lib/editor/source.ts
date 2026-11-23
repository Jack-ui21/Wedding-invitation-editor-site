import { normalizePath } from "../import/analyze";
import { bridgeScript } from "./bridge";
import type { FieldMappings, WeddingDetails, WeddingEvent } from "../data/types";

const ATTRIBUTE_FIELDS = new Set(["mapsUrl", "musicUrl", "instagramUrl", "imageUrl", "mapUrl", "rsvpPhone"]);
const EXTERNAL_REF = /^(data:|https?:|mailto:|tel:|javascript:|#|\/\/)/i;

export function parseSource(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

export function serializeSource(doc: Document): string {
  const doctype = doc.doctype ? `<!DOCTYPE ${doc.doctype.name}>` : "<!DOCTYPE html>";
  return `${doctype}\n${doc.documentElement.outerHTML}`;
}

function find(doc: Document, selector: string): Element | null {
  try {
    return doc.querySelector(selector);
  } catch {
    return null;
  }
}

function setField(doc: Document, key: string, value: string, selector: string): void {
  if (key === "accentColor") {
    let style = doc.querySelector("style[data-wis-accent]");
    if (!style) {
      style = doc.createElement("style");
      style.setAttribute("data-wis-accent", "");
      doc.head.appendChild(style);
    }
    style.textContent = `:root{--primary:${value}!important;--accent:${value}!important;}`;
    return;
  }
  const node = find(doc, selector);
  if (!node) return;
  if (ATTRIBUTE_FIELDS.has(key) || key.endsWith(".mapUrl") || key.endsWith(".imageUrl") || key.endsWith("ImageUrl")) {
    if (node.hasAttribute("src")) node.setAttribute("src", value);
    else node.setAttribute("href", value);
    if (node.tagName.toLowerCase() === "a" && /map/i.test(key)) node.setAttribute("target", "_blank");
  } else {
    node.textContent = value;
  }
}

/** Applies one visual edit directly to the real HTML source. */
export function applyFieldToSource(html: string, key: string, value: string, selector?: string): string {
  if (!selector) return html;
  const doc = parseSource(html);
  setField(doc, key, value, selector);
  return serializeSource(doc);
}

export function valueForField(key: string, details: WeddingDetails, events: WeddingEvent[]): string {
  if (key.startsWith("event.")) {
    const [, index, field] = key.split(".");
    const event = events[Number(index) - 1];
    return (event && (event as unknown as Record<string, string>)[field]) || "";
  }
  return details[key] ?? "";
}

/** reapplies every mapped field after an import or mapping change. */
export function applyMappingsToSource(
  html: string,
  details: WeddingDetails,
  mappings: FieldMappings,
  events: WeddingEvent[],
): string {
  let result = html;
  for (const [key, selector] of Object.entries(mappings)) {
    const value = valueForField(key, details, events);
    if (value) result = applyFieldToSource(result, key, value, selector);
  }
  return result;
}

function patchCountdownScript(code: string, details: WeddingDetails): string {
  if (!details.weddingDate) return code;
  const time = details.weddingTime || "00:00";
  const iso = `${details.weddingDate}T${time.length === 5 ? `${time}:00` : time}`;
  return code.replace(/new Date\(\s*\d{4}\s*,\s*\d{1,2}\s*,\s*\d{1,2}[^)]*\)/g, `new Date(window.__wisTarget || ${JSON.stringify(iso)})`);
}

function rewriteCssUrls(css: string, urlMap: Map<string, string>): string {
  return css.replace(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi, (match, raw: string) => {
    if (EXTERNAL_REF.test(raw)) return match;
    const resolved = normalizePath("styles/inline.css", raw);
    const url = urlMap.get(resolved);
    return url ? `url("${url}")` : match;
  });
}

export interface PreviewOptions {
  html: string;
  mainFilePath: string;
  files: Array<{ path: string; text?: string; url: string }>;
  details: WeddingDetails;
  mappings: FieldMappings;
  events: WeddingEvent[];
  token: string;
  selectMode: boolean;
  publicMode?: boolean;
}

/** Produces the sandboxed iframe document from the current project source. */
export function buildPreviewDocument(options: PreviewOptions): string {
  const doc = parseSource(options.html);
  const urlMap = new Map(options.files.map((file) => [file.path, file.url]));

  // Inline local styles and scripts before generic URL rewriting, otherwise their
  // rewritten storage URLs no longer match the original project paths.
  for (const link of Array.from(doc.querySelectorAll('link[rel="stylesheet"]'))) {
    const href = link.getAttribute("href") ?? "";
    if (EXTERNAL_REF.test(href)) continue;
    const path = normalizePath(options.mainFilePath, href);
    const file = options.files.find((item) => item.path === path);
    if (!file?.text) continue;
    const style = doc.createElement("style");
    style.setAttribute("data-wis-file", path);
    style.textContent = rewriteCssUrls(file.text, urlMap);
    link.replaceWith(style);
  }

  for (const script of Array.from(doc.querySelectorAll("script[src]"))) {
    const src = script.getAttribute("src") ?? "";
    if (EXTERNAL_REF.test(src)) continue;
    const path = normalizePath(options.mainFilePath, src);
    const file = options.files.find((item) => item.path === path);
    if (file?.text == null) continue;
    const inline = doc.createElement("script");
    inline.setAttribute("data-wis-file", path);
    inline.textContent = patchCountdownScript(file.text, options.details);
    script.replaceWith(inline);
  }

  for (const element of Array.from(doc.querySelectorAll("[src], [href]"))) {
    for (const attr of ["src", "href"] as const) {
      const value = element.getAttribute(attr);
      if (!value || EXTERNAL_REF.test(value)) continue;
      const resolved = normalizePath(options.mainFilePath, value);
      const url = urlMap.get(resolved);
      if (url) element.setAttribute(attr, url);
    }
  }

  for (const [key, selector] of Object.entries(options.mappings)) {
    const value = valueForField(key, options.details, options.events);
    if (value) setField(doc, key, value, selector);
  }

  // Public pages keep the countdown/music/accent runtime, but never the editor bridge.
  const script = doc.createElement("script");
  script.setAttribute(options.publicMode ? "data-wis-public" : "data-wis-bridge", "");
  script.textContent = bridgeScript({
    token: options.publicMode ? "" : options.token,
    details: options.details,
    mappings: options.mappings,
    events: options.events,
    selectMode: options.selectMode,
    publicMode: options.publicMode,
  });
  doc.body.appendChild(script);
  return serializeSource(doc);
}
