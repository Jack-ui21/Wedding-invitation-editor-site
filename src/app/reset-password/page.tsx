import { ResetPage } from "@/components/auth/SupabaseReset";

export const dynamic = "force-dynamic";

export default async function PasswordResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return <ResetPage token={params.token} />;
}
