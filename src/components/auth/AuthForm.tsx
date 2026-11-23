"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Heart, Loader2, Sparkles } from "lucide-react";

type Mode = "login" | "register" | "forgot" | "reset";

const COPY: Record<Mode, { eyebrow: string; title: string; subtitle: string; action: string }> = {
  login: { eyebrow: "Welcome back", title: "Sign in to your studio", subtitle: "Manage your invitations in one place.", action: "Sign in" },
  register: { eyebrow: "Create an account", title: "Start your invitation", subtitle: "Your projects stay private to you.", action: "Create account" },
  forgot: { eyebrow: "Account recovery", title: "Reset your password", subtitle: "We'll help you get back into your studio.", action: "Send reset link" },
  reset: { eyebrow: "Account recovery", title: "Choose a new password", subtitle: "Use at least 8 characters.", action: "Update password" },
};

export function AuthForm({ mode, resetToken }: { mode: Mode; resetToken?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const copy = COPY[mode];

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const payload: Record<string, string> = {};
    for (const [key, value] of form.entries()) payload[key] = String(value);
    if (mode === "reset") payload.token = resetToken ?? "";
    const endpoint =
      mode === "login" ? "/api/auth/login"
      : mode === "register" ? "/api/auth/register"
      : mode === "forgot" ? "/api/auth/forgot-password"
      : "/api/auth/reset-password";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string; message?: string; user?: { role: string } };
      if (!response.ok) throw new Error(result.error ?? "Request failed");
      setMessage(result.message ?? "");
      if (mode === "login") {
        router.push(result.user?.role === "owner" ? "/owner" : "/dashboard");
        router.refresh();
      } else if (mode === "reset") {
        router.push("/login?reset=1");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_15%_10%,#f6e7df_0%,transparent_45%),radial-gradient(circle_at_85%_90%,#efe2ee_0%,transparent_50%)] px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-black/8 bg-white shadow-[0_30px_90px_-50px_rgba(48,18,44,0.55)] md:grid-cols-[1fr_1.05fr]">
        <section className="hidden flex-col justify-between bg-plum-deep p-10 text-white md:flex">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <span className="grid size-10 place-items-center rounded-xl bg-white/10"><Heart size={19} /></span>
            Wedding Invitation Studio
          </div>
          <div>
            <Sparkles className="mb-5 text-gold" size={30} />
            <h2 className="text-4xl leading-tight">Every detail, beautifully yours.</h2>
            <p className="mt-4 max-w-sm text-sm leading-7 text-white/65">
              Import a template, personalise the words, photos and music, then publish a private link for your guests.
            </p>
          </div>
          <p className="text-xs text-white/40">Made for modern celebrations · Built for mobile</p>
        </section>

        <section className="p-6 sm:p-10">
          <div className="mb-7 md:hidden">
            <div className="flex items-center gap-2 text-base font-semibold text-plum">
              <span className="grid size-9 place-items-center rounded-xl bg-plum/10"><Heart size={17} /></span>
              Wedding Invitation Studio
            </div>
          </div>
          <p className="text-xs font-bold tracking-[0.2em] text-gold uppercase">{copy.eyebrow}</p>
          <h1 className="mt-2 text-3xl text-ink">{copy.title}</h1>
          <p className="mt-2 text-sm text-black/55">{copy.subtitle}</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === "register" && (
              <div>
                <label className="ws-label" htmlFor="name">Your name</label>
                <input className="ws-input" id="name" name="name" autoComplete="name" required minLength={2} placeholder="Full name" />
              </div>
            )}
            {(mode === "login" || mode === "register" || mode === "forgot") && (
              <div>
                <label className="ws-label" htmlFor="email">Email address</label>
                <input className="ws-input" id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
              </div>
            )}
            {mode === "register" && (
              <div>
                <label className="ws-label" htmlFor="phone">WhatsApp number <span className="font-normal normal-case">(optional)</span></label>
                <input className="ws-input" id="phone" name="phone" type="tel" autoComplete="tel" placeholder="919876543210" />
              </div>
            )}
            {(mode === "login" || mode === "register" || mode === "reset") && (
              <div>
                <label className="ws-label" htmlFor="password">
                  {mode === "login" ? "Password" : "New password"}
                </label>
                <input className="ws-input" id="password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} placeholder="At least 8 characters" />
              </div>
            )}

            {error && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">{error}</p>}
            {message && <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">{message}</p>}

            <button className="ws-btn-primary w-full" disabled={busy} type="submit">
              {busy ? <Loader2 className="animate-spin" size={17} /> : null}
              {copy.action}
              {!busy && <ArrowRight size={16} />}
            </button>
          </form>

          <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {mode === "login" && (
              <>
                <Link className="text-plum underline-offset-4 hover:underline" href="/forgot-password">Forgot password?</Link>
                <Link className="text-plum underline-offset-4 hover:underline" href="/register">Create an account</Link>
              </>
            )}
            {mode !== "login" && (
              <Link className="text-plum underline-offset-4 hover:underline" href="/login">Back to sign in</Link>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
