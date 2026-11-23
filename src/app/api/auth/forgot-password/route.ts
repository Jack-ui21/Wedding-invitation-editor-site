import { NextResponse } from "next/server";
import { DATA_DRIVER } from "@/lib/config";
import { getStore } from "@/lib/data/get-store";

export async function POST(request: Request) {
  try {
    const { email } = (await request.json()) as { email?: string };
    if (!email?.includes("@")) return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
    const store = getStore();
    const user = await store.getUserByEmail(email.trim().toLowerCase());
    if (!user) {
      // Do not reveal whether an account exists.
      return NextResponse.json({ ok: true, message: "If that account exists, reset instructions have been sent." });
    }
    const token = await store.createPasswordReset(user.id);
    return NextResponse.json({
      ok: true,
      message:
        DATA_DRIVER === "local"
          ? `Local development reset token: ${token}`
          : "If that account exists, reset instructions have been sent.",
      ...(DATA_DRIVER === "local" && token ? { token } : {}),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Reset request failed" }, { status: 400 });
  }
}
