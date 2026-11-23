/** Central runtime configuration. Never import service-role keys from client code. */

export type DataDriver = "local" | "supabase";

/** Safe to read in browser code: selects the upload strategy, never contains secrets. */
export const PUBLIC_DATA_DRIVER = process.env.NEXT_PUBLIC_DATA_DRIVER === "supabase" ? "supabase" : "local";

function resolveDriver(): DataDriver {
  const explicit = process.env.DATA_DRIVER;
  if (explicit === "local" || explicit === "supabase") return explicit;
  return process.env.NEXT_PUBLIC_SUPABASE_URL ? "supabase" : "local";
}

export const DATA_DRIVER = resolveDriver();

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
export const OWNER_EMAIL = (process.env.OWNER_EMAIL ?? "owner@example.com").toLowerCase();
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const SESSION_SECRET =
  process.env.SESSION_SECRET ?? process.env.DEV_SESSION_SECRET ?? "local-development-only-change-me";
export const STORAGE_BUCKET = "project-files";

export function assertProductionConfig() {
  if (process.env.NODE_ENV === "production" && DATA_DRIVER === "local") {
    throw new Error(
      "DATA_DRIVER=local is not allowed in production. Configure Supabase environment variables and set DATA_DRIVER=supabase.",
    );
  }
  if (process.env.NODE_ENV === "production" && SESSION_SECRET.length < 32 && DATA_DRIVER === "supabase") {
    throw new Error("SESSION_SECRET must be at least 32 random characters in production.");
  }
  if (DATA_DRIVER === "supabase") {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "Supabase driver selected but NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY is missing.",
      );
    }
  }
}

export const MAX_IMPORT_BYTES = 120 * 1024 * 1024; // 120 MB per project import
export const MAX_ASSET_BYTES = 25 * 1024 * 1024; // 25 MB per uploaded asset
export const ALLOWED_IMPORT_EXTENSIONS = [".html", ".htm", ".zip", ".css", ".js", ".json"] as const;
