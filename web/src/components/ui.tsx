"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "quiet";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

const sizes = { md: "px-5 py-2.5 text-[0.95rem]", lg: "px-7 py-3.5 text-base" };

const variants: Record<Variant, string> = {
  primary:
    "bg-maroon text-ground shadow-[0_10px_24px_-12px_rgba(107,18,38,0.7)] hover:brightness-110",
  ghost:
    "border border-card-edge text-ink hover:bg-black/[0.04] dark:hover:bg-white/[0.06]",
  quiet: "text-ink-soft hover:text-ink",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: {
  variant?: Variant;
  size?: keyof typeof sizes;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  size?: keyof typeof sizes;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={`rounded-2xl border border-card-edge bg-card shadow-[var(--shadow-card)] ${className}`}
    >
      {children}
    </div>
  );
}

export function Field({
  label,
  hint,
  ...rest
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-soft">{label}</span>
      <input
        className="w-full rounded-xl border border-card-edge bg-ground-2 px-3.5 py-2.5 text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
        {...rest}
      />
      {hint ? <span className="mt-1 block text-xs text-ink-faint">{hint}</span> : null}
    </label>
  );
}

export function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
        active
          ? "border-gold bg-gold/15 text-maroon dark:text-gold"
          : "border-card-edge bg-ground-2 text-ink-soft hover:border-gold/50"
      }`}
    >
      {children}
    </button>
  );
}

export function Rule() {
  return (
    <div className="mx-auto flex w-40 items-center gap-3">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold" />
      <span className="size-2 rotate-45 bg-gold" />
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold" />
    </div>
  );
}
