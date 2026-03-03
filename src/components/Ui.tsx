import React from "react";
import { cx } from "../lib/ui";

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cx("glass rounded-2xl p-4 shadow-soft", className)}>{children}</div>
  );
}

export function Button({
  children, className, variant="default", ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "primary" | "danger" }) {
  const base = "rounded-xl px-3 py-2 text-sm border transition disabled:opacity-50 disabled:cursor-not-allowed";
  const styles = variant === "primary"
    ? "border-emerald-400/30 bg-emerald-400/15 hover:bg-emerald-400/22"
    : variant === "danger"
      ? "border-rose-400/30 bg-rose-400/12 hover:bg-rose-400/18"
      : "border-slate-700/40 bg-slate-900/35 hover:bg-slate-900/55";
  return (
    <button className={cx(base, styles, className)} {...props}>{children}</button>
  );
}

export function Input({
  label, className, ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className={cx("block", className)}>
      {label && <div className="text-xs text-slate-400 mb-1">{label}</div>}
      <input
        className="w-full rounded-xl border border-slate-700/40 bg-slate-950/40 px-3 py-2 outline-none focus:border-emerald-400/35"
        {...props}
      />
    </label>
  );
}

export function Select({
  label, className, children, ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; children: React.ReactNode }) {
  return (
    <label className={cx("block", className)}>
      {label && <div className="text-xs text-slate-400 mb-1">{label}</div>}
      <select
        className="w-full rounded-xl border border-slate-700/40 bg-slate-950/40 px-3 py-2 outline-none focus:border-emerald-400/35"
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-700/40 bg-slate-900/30 px-3 py-1 text-xs text-slate-300">
      {children}
    </span>
  );
}
