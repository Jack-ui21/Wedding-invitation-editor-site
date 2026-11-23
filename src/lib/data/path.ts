/** Reject traversal, absolute paths and Windows separators before touching storage. */
export function safeRelativePath(input: string): string {
  if (typeof input !== "string" || !input.trim()) throw new Error("Invalid file path");
  const cleaned = input.trim().replace(/\\/g, "/");
  if (cleaned.includes("\0")) throw new Error("Invalid file path");
  if (cleaned.startsWith("/") || /^[a-zA-Z]:/.test(cleaned)) throw new Error("Invalid file path");
  const parts = cleaned.split("/");
  if (parts.some((part) => part === ".." || part === "." || !part)) throw new Error("Invalid file path");
  return parts.join("/");
}

export function slugify(value: string): string {
  const base = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "wedding";
}

export function detectFileKind(path: string): "html" | "css" | "js" | "image" | "audio" | "font" | "other" {
  const ext = path.toLowerCase().split("?")[0].split(".").pop() ?? "";
  if (["html", "htm"].includes(ext)) return "html";
  if (ext === "css") return "css";
  if (["js", "mjs", "cjs"].includes(ext)) return "js";
  if (["png", "jpg", "jpeg", "webp", "gif", "svg", "avif", "ico", "bmp"].includes(ext)) return "image";
  if (["mp3", "wav", "m4a", "ogg", "aac", "flac"].includes(ext)) return "audio";
  if (["woff", "woff2", "ttf", "otf", "eot"].includes(ext)) return "font";
  return "other";
}

export function mimeForPath(path: string): string {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  const types: Record<string, string> = {
    html: "text/html; charset=utf-8",
    htm: "text/html; charset=utf-8",
    css: "text/css; charset=utf-8",
    js: "text/javascript; charset=utf-8",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
    avif: "image/avif",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    ogg: "audio/ogg",
    woff2: "font/woff2",
    woff: "font/woff",
    ttf: "font/ttf",
  };
  return types[ext] ?? "application/octet-stream";
}
