"use client";

import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AuthForm } from "./AuthForm";

interface HashTokens {
  access_token: string;
  refresh_token: string;
}

/** Supabase password recovery links carry tokens in the URL hash. */
export function ResetPage({ token }: { token?: string }) {
  const [state, setState] = useState<"checking" | "supabase" | "local">("checking");
  const [tokens, setTokens] = useState<HashTokens | null>(null);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const access = hash.get("access_token");
    const refresh = hash.get("refresh_token");
    if (access && refresh) {
      setTokens({ access_token: access, refresh_token: refresh });
      setState("supabase");
    } else {
      setState("local");
    }
  }, []);

  if (state === "checking") {
    return <main className="grid min-h-screen place-items-center text-sm text-black/60">Preparing secure reset…</main>;
  }
  if (state === "supabase" && tokens) return <SupabaseResetForm tokens={tokens} />;
  return <AuthForm mode="reset" resetToken={token} />;
}

function SupabaseResetForm({ tokens }: { tokens: HashTokens }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      setError("Supabase is not configured.");
      setBusy(false);
      return;
    }
    const supabase = createClient(url, anon);
    const session = await supabase.auth.setSession(tokens);
    if (session.error) {
      setError(session.error.message);
      setBusy(false);
      return;
    }
    const result = await supabase.auth.updateUser({ password });
    if (result.error) {
      setError(result.error.message);
      setBusy(false);
      return;
    }
    await supabase.auth.signOut();
    router.push("/login?reset=1");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-ivory px-4">
      <form onSubmit={submit} className="ws-card w-full max-w-md space-y-4 p-7">
        <h1 className="text-2xl text-ink">Choose a new password</h1>
        <p className="text-sm text-black/55">At least 8 characters.</p>
        <input className="ws-input" type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New password" />
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
        <button className="ws-btn-primary w-full" disabled={busy}>{busy ? <Loader2 className="animate-spin" size={16} /> : "Update password"}</button>
      </form>
    </main>
  );
}
