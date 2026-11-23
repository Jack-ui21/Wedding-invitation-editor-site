import { detectFileKind } from "../data/path";
import type { AssetReference, DetectedField, FieldKey } from "./types";

function escapeIdent(value: string): string {
  if (/^[-_a-zA-Z][-_a-zA-Z0-9]*$/.test(value)) return value;
  return value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
}

export function selectorFor(element: Element): string {
  if (element.id) return `#${escapeIdent(element.id)}`;
  const segments: string[] = [];
  let current: Element | null = element;
  while (current && current.tagName.toLowerCase() !== "html") {
    const tag = current.tagName.toLowerCase();
    const parent: Element | null = current.parentElement;
    if (parent) {
      const sameTag = Array.from(parent.children).filter((child) => child.tagName.toLowerCase() === tag);
      const index = sameTag.indexOf(current) + 1;
      segments.unshift(index > 1 ? `${tag}:nth-of-type(${index})` : tag);
    } else {
      segments.unshift(tag);
    }
    current = parent;
  }
  return segments.join(" > ");
}

function visibleText(element: Element): string {
  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}

interface Pattern {
  key: FieldKey;
  re: RegExp;
  confidence: number;
  maxLength?: number;
  minLength?: number;
  attribute?: "href" | "src";
}

const PATTERNS: Pattern[] = [
  { key: "brideName", re: /(bride.*name|bridename|hero[-_]?bride|ftbride)/i, confidence: 0.95, maxLength: 60 },
  { key: "groomName", re: /(groom.*name|groomname|hero[-_]?groom|ftgroom)/i, confidence: 0.95, maxLength: 60 },
  { key: "coupleNames", re: /(couplenames|ftnames|invitenames)/i, confidence: 0.9, maxLength: 100 },
  { key: "weddingDate", re: /(weddingdate|event[-_]?date|date[-_]?[a-z0-9]+|targetdate|countdown_target_date|hero[-_]?event[-_]?date|ftdate)/i, confidence: 0.85, maxLength: 80 },
  { key: "weddingTime", re: /(weddingtime|event[-_]?time|time[-_]?[a-z0-9]+)/i, confidence: 0.8, maxLength: 60 },
  { key: "venue", re: /(venue|address|location|event_venue|link_.*map)/i, confidence: 0.82, maxLength: 120 },
  { key: "venueAddress", re: /(address|venue_address|hero-address)/i, confidence: 0.8, maxLength: 160 },
  { key: "mapsUrl", re: /(map|route|location)/i, confidence: 0.85, attribute: "href" },
  { key: "welcomeMessage", re: /(welcom|eagerlywaiting|invitationmessage|invite|footer_message|story-description)/i, confidence: 0.75, minLength: 12, maxLength: 500 },
  { key: "invitationMessage", re: /(invitation|invitemessage|c_note|blessing)/i, confidence: 0.72, minLength: 12, maxLength: 500 },
  { key: "brideFamily", re: /(bride.*(family|parent)|brideFamilyDetail)/i, confidence: 0.9, maxLength: 200 },
  { key: "groomFamily", re: /(groom.*(family|parent)|groomFamilyDetail)/i, confidence: 0.9, maxLength: 200 },
  { key: "parentsNames", re: /(parents?.*name|parents_d4)/i, confidence: 0.85, maxLength: 200 },
  { key: "countdownHeading", re: /(countdown.*title|footer_title|eagerlyWaitingTitle)/i, confidence: 0.9, maxLength: 120 },
  { key: "instagramUrl", re: /(instagram|social)/i, confidence: 0.8, attribute: "href" },
  { key: "musicUrl", re: /(music|audio|bgmusic)/i, confidence: 0.85, attribute: "src" },
];

const EVENT_FIELD_RE = /event[_-]?(\d+|[a-z0-9]{8,})[_-](name|date|time|venue|location|description|map|image)/i;
const SHORT_EVENT_RE = /^(name|date|time|venue|location|map)_[a-z0-9]{4,}$/i;

function eventFieldKey(raw: string): string | null {
  switch (raw.toLowerCase()) {
    case "name": return "name";
    case "date": return "date";
    case "time": return "time";
    case "venue":
    case "location": return "location";
    case "description": return "description";
    case "map": return "mapUrl";
    case "image": return "imageUrl";
    default: return null;
  }
}

/** Detects editable fields from ids, classes, element structure and link targets. */
export function detectFields(doc: Document): DetectedField[] {
  const candidates: DetectedField[] = [];
  const eventGroups = new Map<string, number>();
  const elements = Array.from(doc.querySelectorAll("body *"));

  for (const element of elements) {
    const id = element.id || "";
    const className = typeof element.className === "string" ? element.className : "";
    const haystack = `${id} ${className}`;
    const text = visibleText(element);
    const tag = element.tagName.toLowerCase();

    const eventMatch = id.match(EVENT_FIELD_RE) ?? (SHORT_EVENT_RE.test(id) ? id.match(/^([a-z]+)_([a-z0-9]+)$/i) : null);
    if (eventMatch) {
      const group = eventMatch[1];
      const field = eventFieldKey(eventMatch[2]);
      if (field) {
        if (!eventGroups.has(group)) eventGroups.set(group, eventGroups.size + 1);
        const index = eventGroups.get(group)!;
        const isLink = field === "mapUrl" && tag === "a";
        const isImage = field === "imageUrl" && tag === "img";
        const value = isLink ? element.getAttribute("href") ?? "" : isImage ? element.getAttribute("src") ?? "" : text;
        if (value) {
          candidates.push({
            key: `event.${index}.${field}`,
            selector: selectorFor(element),
            text: value.slice(0, 200),
            confidence: 0.92,
            source: "id",
          });
        }
      }
    }

    for (const pattern of PATTERNS) {
      if (!pattern.re.test(haystack)) continue;
      if (pattern.attribute === "href" && tag !== "a") continue;
      if (pattern.attribute === "src" && !["img", "audio", "source", "video"].includes(tag)) continue;
      const value = pattern.attribute ? element.getAttribute(pattern.attribute) ?? "" : text;
      if (!value) continue;
      if (pattern.minLength && value.length < pattern.minLength) continue;
      if (pattern.maxLength && value.length > pattern.maxLength) continue;
      // Prefer the innermost element: skip containers whose children already carry the same text.
      if (!pattern.attribute && element.children.length && Array.from(element.children).some((child) => visibleText(child) === text)) continue;
      candidates.push({
        key: pattern.key,
        selector: selectorFor(element),
        text: value.slice(0, 300),
        confidence: pattern.confidence,
        source: id ? "id" : "class",
      });
    }
  }

  // Semantic fallbacks: first short headline after "with the heavenly blessings", etc.
  if (!candidates.some((field) => field.key === "brideName")) {
    const names = Array.from(doc.querySelectorAll("[class*='invite-name'], [class*='bride-name'], [class*='font-name']"));
    names.slice(0, 2).forEach((element, index) => {
      const text = visibleText(element);
      if (text && text.length < 60) {
        candidates.push({ key: index === 0 ? "brideName" : "groomName", selector: selectorFor(element), text, confidence: 0.6, source: "structure" });
      }
    });
  }

  const best = new Map<string, DetectedField>();
  for (const candidate of candidates) {
    const existing = best.get(candidate.key);
    if (!existing || candidate.confidence > existing.confidence) best.set(candidate.key, candidate);
  }
  return Array.from(best.values()).sort((a, b) => b.confidence - a.confidence);
}

export function detectAssetReferences(doc: Document, basePath: string): AssetReference[] {
  const refs: AssetReference[] = [];
  const attrs: Array<[string, "src" | "href"]> = [
    ["img", "src"],
    ["audio", "src"],
    ["source", "src"],
    ["video", "src"],
    ["link", "href"],
    ["a", "href"],
    ["iframe", "src"],
  ];
  for (const [selector, attribute] of attrs) {
    for (const element of Array.from(doc.querySelectorAll(selector))) {
      const value = element.getAttribute(attribute) ?? "";
      if (!value) continue;
      const dataUri = value.startsWith("data:");
      const external = /^(https?:|mailto:|tel:|javascript:|#)/i.test(value);
      if (dataUri || external) continue;
      refs.push({ path: value, kind: detectFileKind(value), external, dataUri });
    }
  }
  // CSS url() references inside inline styles.
  const css = Array.from(doc.querySelectorAll("style")).map((node) => node.textContent ?? "").join("\n");
  for (const match of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) {
    const value = match[1];
    if (!value || value.startsWith("data:") || /^(https?:|#)/i.test(value)) continue;
    refs.push({ path: value, kind: detectFileKind(value), external: false, dataUri: false });
  }
  return refs.filter((ref, index, all) => all.findIndex((item) => item.path === ref.path) === index).map((ref) => ({ ...ref, path: normalizePath(basePath, ref.path) }));
}

export function normalizePath(baseFile: string, reference: string): string {
  if (reference.startsWith("data:") || /^[a-z]+:/i.test(reference)) return reference;
  const clean = reference.split("?")[0].split("#")[0].replace(/\\/g, "/");
  const dir = baseFile.includes("/") ? baseFile.slice(0, baseFile.lastIndexOf("/") + 1) : "";
  const parts = `${dir}${clean}`.split("/");
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

export function countDataUris(text: string): number {
  return (text.match(/data:image\/[a-z0-9.+-]+;base64,/gi) ?? []).length;
}
