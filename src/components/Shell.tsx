import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../state/auth";

export default function Shell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const loc = useLocation();

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-20 border-b border-slate-700/30 bg-slate-950/50 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/app" className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-gradient-to-tr from-emerald-400 to-sky-400 shadow-[0_0_0_6px_rgba(34,197,94,.10)]" />
            <div>
              <div className="font-extrabold tracking-tight leading-4">PulseMeet</div>
              <div className="text-xs text-slate-400">1:1 video + chat</div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {user && (
              <>
                <div className="hidden sm:block text-sm text-slate-300">
                  {user.email}
                </div>
                <button
                  onClick={() => signOut()}
                  className="rounded-xl border border-slate-700/40 bg-slate-900/40 px-3 py-2 text-sm hover:bg-slate-900/60 transition"
                >
                  Sign out
                </button>
              </>
            )}
            {!user && loc.pathname !== "/auth" && (
              <Link
                className="rounded-xl border border-slate-700/40 bg-slate-900/40 px-3 py-2 text-sm hover:bg-slate-900/60 transition"
                to="/auth"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
    </div>
  );
}
