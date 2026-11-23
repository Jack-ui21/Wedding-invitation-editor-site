import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getStore } from "@/lib/data/get-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (user?.role !== "owner") return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  const store = getStore();
  const [customers, users, projects] = await Promise.all([store.listCustomers(), store.listUsers(), store.listProjects()]);
  return NextResponse.json({
    customers: customers.map((customer) => ({
      ...customer,
      userName: users.find((item) => item.id === customer.userId)?.name ?? "",
      projectCount: projects.filter((project) => project.customerId === customer.id).length,
    })),
  });
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (user?.role !== "owner") return NextResponse.json({ error: "Owner access required" }, { status: 403 });
    const body = (await request.json()) as { name?: string; email?: string; phone?: string; password?: string };
    if (!body.name?.trim() || !body.email?.includes("@") || !body.password || body.password.length < 8) {
      return NextResponse.json(
        { error: "Name, valid email and a password of at least 8 characters are required" },
        { status: 400 },
      );
    }
    const store = getStore();
    const email = body.email.trim().toLowerCase();
    if (await store.getUserByEmail(email)) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }
    const account = await store.createUser({ name: body.name, email, password: body.password, role: "customer" });
    const customer = await store.createCustomer({ userId: account.id, name: body.name, email, phone: body.phone ?? "" });
    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not add customer" }, { status: 400 });
  }
}
