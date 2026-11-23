import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DATA_DRIVER, SESSION_SECRET, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
import { getStore } from "./data/get-store";
import { verifyLocalPassword } from "./data/local";
import type { SessionUser } from "./data/types";

export const SESSION_COOKIE = "wis_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmacKey() {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createSessionToken(userId: string): Promise<string> {
  const payload = toBase64Url(
    new TextEncoder().encode(
      JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }),
    ),
  );
  const signature = toBase64Url(
    new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), new TextEncoder().encode(payload))),
  );
  return `${payload}.${signature}`;
}

async function readSessionToken(token: string): Promise<string | null> {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(),
    new Uint8Array(fromBase64Url(signature)),
    new TextEncoder().encode(payload),
  );
  if (!valid) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as { sub: string; exp: number };
    if (!parsed.sub || parsed.exp * 1000 <= Date.now()) return null;
    return parsed.sub;
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = await readSessionToken(token);
  if (!userId) return null;
  const store = getStore();
  const user = await store.getUserById(userId);
  if (!user) return null;
  return store.sessionUser(user);
}

export async function requireUser(redirectTo = "/login"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(redirectTo);
  return user;
}

export async function requireOwner(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "owner") redirect("/dashboard");
  return user;
}

export async function setSessionCookie(userId: string): Promise<void> {
  const token = await createSessionToken(userId);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Verifies credentials. Supabase passwords are checked through its auth endpoint. */
export async function verifyCredentials(email: string, password: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const store = getStore();
  if (DATA_DRIVER === "local") {
    const user = await store.getUserByEmail(normalized);
    if (!user?.passwordHash || !verifyLocalPassword(password, user.passwordHash)) {
      throw new Error("Invalid email or password");
    }
    return user.id;
  }
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: normalized, password }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Invalid email or password");
  const result = (await response.json()) as { user?: { id?: string } };
  if (!result.user?.id) throw new Error("Invalid email or password");
  const localUser = await store.getUserById(result.user.id);
  if (!localUser) throw new Error("This account is not registered in the studio");
  return localUser.id;
}
