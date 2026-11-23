import { NextResponse } from "next/server";
import { getStore } from "@/lib/data/get-store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string; email?: string; password?: string; phone?: string };
    const name = body.name?.trim() ?? "";
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    const phone = body.phone?.trim() ?? "";
    if (name.length < 2) return NextResponse.json({ error: "Please enter your name" }, { status: 400 });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    const store = getStore();
    if (await store.getUserByEmail(email)) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }
    const user = await store.createUser({ name, email, password, role: "customer" });
    await store.createCustomer({ name, email, phone, userId: user.id });
    return NextResponse.json({ ok: true, message: "Account created. You can sign in now." });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Registration failed" },
      { status: 400 },
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
