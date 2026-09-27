"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm({ next, confirmError }: { next: string; confirmError: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(
    confirmError ? { kind: "error", text: "That confirmation link is invalid or expired. Try signing in again." } : null,
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const { data, error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
          });
    setBusy(false);
    if (error) return setMessage({ kind: "error", text: error.message });
    if (!data.session) {
      return setMessage({ kind: "info", text: "Check your inbox and click the confirmation link to finish signing up." });
    }
    router.replace(next);
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="panel space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">{mode === "signin" ? "Welcome back" : "Create an account"}</h1>
        <p className="text-sm text-slate-400">Save circuits, programs and files to the cloud.</p>
      </div>
      <label className="block space-y-1">
        <span className="text-xs text-slate-400">Email</span>
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-slate-400">Password</span>
        <input
          type="password"
          required
          minLength={6}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field"
        />
      </label>
      {message && (
        <p className={`text-sm ${message.kind === "error" ? "text-rose-400" : "text-emerald-400"}`}>{message.text}</p>
      )}
      <button type="submit" disabled={busy} className="btn btn-primary w-full justify-center py-2">
        {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
      </button>
      <p className="text-center text-sm text-slate-400">
        {mode === "signin" ? "New here? " : "Already have an account? "}
        <button
          type="button"
          className="text-sky-400 hover:underline"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setMessage(null);
          }}
        >
          {mode === "signin" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </form>
  );
}
