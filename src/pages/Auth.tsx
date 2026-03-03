import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Shell from "../components/Shell";
import { Button, Card, Input } from "../components/Ui";
import { supabase } from "../lib/supabase";

export default function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const title = useMemo(() => mode === "login" ? "Sign in" : "Create account", [mode]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName || undefined } },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      nav("/app");
    } catch (e: any) {
      setErr(e?.message ?? "Auth failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <div className="grid place-items-center min-h-[70vh]">
        <Card className="w-full max-w-md p-6">
          <div className="text-2xl font-extrabold">{title}</div>
          <div className="mt-1 text-sm text-slate-400">
            {mode === "login" ? "Use your account to continue." : "Fast, secure, resume-grade build."}
          </div>

          <form className="mt-4 space-y-3" onSubmit={submit}>
            {mode === "register" && (
              <Input
                label="Display name (optional)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Atlas"
              />
            )}
            <Input
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              type="email"
              required
            />
            <Input
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
              required
            />

            {err && (
              <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
                {err}
              </div>
            )}

            <Button variant="primary" className="w-full" disabled={loading}>
              {loading ? "Working…" : (mode === "login" ? "Sign in" : "Create account")}
            </Button>
          </form>

          <div className="mt-3 text-sm text-slate-300">
            {mode === "login" ? "New here?" : "Already have an account?"}{" "}
            <button
              className="text-emerald-300 hover:underline"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login" ? "Create one" : "Sign in"}
            </button>
          </div>
        </Card>
      </div>
    </Shell>
  );
}
