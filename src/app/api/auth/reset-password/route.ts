import { NextResponse } from "next/server";
import { DATA_DRIVER } from "@/lib/config";
import { getStore } from "@/lib/data/get-store";

export async function POST(request: Request) {
  try {
    const { token, password } = (await request.json()) as { token?: string; password?: string };
    if (!token || !password || password.length < 8) {
      return NextResponse.json({ error: "A valid token and a password of 8+ characters are required" }, { status: 400 });
    }
    if (DATA_DRIVER !== "local") {
      return NextResponse.json(
        { error: "Use the password reset link sent by Supabase to set a new password." },
        { status: 400 },
      );
    }
    const store = getStore();
    const userId = await store.consumePasswordReset(token);
    if (!userId) return NextResponse.json({ error: "This reset link is invalid or has expired" }, { status: 400 });
    await store.setPassword(userId, password);
    return NextResponse.json({ ok: true, message: "Password updated. You can sign in now." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Reset failed" }, { status: 400 });
  }
}
