import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../state/auth";

export default function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen grid place-items-center text-slate-300">
      <div className="glass rounded-2xl px-5 py-4 shadow-soft">Loading…</div>
    </div>
  );
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}
