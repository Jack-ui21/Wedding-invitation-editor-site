import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(user.role === "owner" ? "/owner" : "/dashboard");
  return <AuthForm mode="login" />;
}
