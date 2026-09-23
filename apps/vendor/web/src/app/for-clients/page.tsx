"use client";

// "For clients" — new page (2026-09), not a port of an existing section.
// Home was entirely client-facing before this split (see home/page.tsx's own
// header comment), but nothing on it made the trust/escrow case on its own
// terms the way the old #vendors section made the vendor case. Carries the
// escrow/trust content that used to sit mid-scroll on Home. See
// docs/DECISIONS.md for the Home-trim reasoning.

import { useAuth } from "@/lib/auth";
import { LinkButton } from "@/components/ui";
import { Eyebrow } from "@/components/marketing/Eyebrow";
import { IconLock, IconShield, IconUsers } from "@/components/marketing/icons";

const ESCROW_STAGES = [
  { label: "Unpaid", status: "Pending", desc: "Not yet charged", tone: "maroon" },
  { label: "In escrow", status: "In escrow", desc: "Securely held", tone: "gold" },
  { label: "Released", status: "Released", desc: "After you confirm", tone: "green" },
  { label: "Refunded", status: "Refunded", desc: "If something goes wrong", tone: "maroon" },
] as const;

const TRUST_POINTS = [
  {
    icon: IconLock,
    title: "Your money is held, not spent",
    body: "When you pay, it goes into escrow — not straight to the vendor. It stays there until after the celebration, so you're never out of pocket for someone who doesn't show up.",
  },
  {
    icon: IconShield,
    title: "Vendors are paid when you confirm",
    body: "After the event you confirm it went well, and only then is the vendor paid. If something goes wrong, the money doesn't move until it's sorted.",
  },
  {
    icon: IconUsers,
    title: "Every booking in one place",
    body: "All your vendors, dates, messages, and payments sit under one event — each with a clear status, so you always know what's confirmed and what's still waiting.",
  },
];

export default function ForClientsPage() {
  const { user, loading } = useAuth();
  const primary = user
    ? { href: "/plan", label: "Build a bundle" }
    : { href: "/login?mode=register", label: "Get started — it's free" };

  return (
    <div>
      <section className="border-b border-line-soft bg-gradient-to-b from-ground to-panel px-5 pb-16 pt-16 md:pb-24 md:pt-24">
        <div className="mx-auto w-[min(var(--container-wide),100%)]">
          <Eyebrow>For clients</Eyebrow>
          <h1 className="serif max-w-2xl text-4xl text-maroon dark:text-gold md:text-6xl">
            Safe to pay months in advance.
          </h1>
          <p className="mt-6 max-w-[56ch] text-lg leading-relaxed text-ink-soft md:text-xl">
            Booking a celebration means handing over large sums, sometimes a year ahead.
            Jorna was built specifically to make that feel safe.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {loading ? null : (
              <>
                <LinkButton href={primary.href} size="lg">
                  {primary.label}
                </LinkButton>
                <LinkButton href="/browse" variant="ghost" size="lg">
                  Browse vendors
                </LinkButton>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="bg-panel px-5 py-20 md:py-28">
        <div className="mx-auto w-[min(var(--container-wide),100%)]">
          <div className="mx-auto mb-12 max-w-lg text-center">
            <Eyebrow>Protected by escrow</Eyebrow>
            <h2 className="serif text-3xl text-maroon dark:text-gold md:text-4xl">
              Where your money is, at every stage.
            </h2>
          </div>

          <div className="rounded-2xl border border-card-edge bg-card p-6 shadow-[var(--shadow-card)] md:p-8">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-ink-faint">
              Where your money is, at every stage
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
              {ESCROW_STAGES.map((stage) => (
                <div key={stage.label} className="rounded-xl border border-line-soft bg-panel p-4">
                  <p className="text-xs text-ink-faint">{stage.label}</p>
                  <span
                    className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      stage.tone === "green"
                        ? "bg-green/12 text-green"
                        : stage.tone === "gold"
                          ? "bg-gold/15 text-gold"
                          : "bg-maroon/10 text-maroon dark:text-gold"
                    }`}
                  >
                    {stage.status}
                  </span>
                  <p className="mt-2 text-xs text-ink-faint">{stage.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {TRUST_POINTS.map((point) => (
              <div
                key={point.title}
                className="rounded-2xl border border-card-edge bg-card p-7 shadow-[var(--shadow-card)]"
              >
                <span className="mb-5 grid size-11 place-items-center rounded-xl bg-maroon/8 text-maroon dark:bg-gold/10 dark:text-gold">
                  {point.icon}
                </span>
                <h3 className="serif text-lg text-ink">{point.title}</h3>
                <p className="mt-3 leading-relaxed text-ink-soft">{point.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20">
        <div className="mx-auto w-[min(var(--container-wide),100%)]">
          <div className="rounded-2xl border border-card-edge bg-panel px-8 py-14 text-center">
            <h2 className="serif text-3xl text-maroon dark:text-gold md:text-4xl">
              Ready to plan your celebration?
            </h2>
            <p className="mx-auto mt-4 max-w-md leading-relaxed text-ink-soft">
              Tell us about your event and we&apos;ll have three complete vendor teams
              ready to compare.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              {loading ? null : (
                <>
                  <LinkButton href={primary.href} size="lg">
                    Start planning
                  </LinkButton>
                  <LinkButton href="/browse" variant="ghost" size="lg">
                    Browse vendors
                  </LinkButton>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
