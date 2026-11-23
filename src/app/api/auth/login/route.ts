import { NextResponse } from "next/server";
import { setSessionCookie, verifyCredentials } from "@/lib/auth";
import { getStore } from "@/lib/data/get-store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    if (!body.email || !body.password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }
    const userId = await verifyCredentials(body.email, body.password);
    const store = getStore();
    const user = await store.getUserById(userId);
    if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    await setSessionCookie(userId);
    const session = await store.sessionUser(user);
    return NextResponse.json({ ok: true, user: session });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sign in failed" }, { status: 401 });
  }
}
