"use client";

// "For vendors" — split out of home/page.tsx's #vendors anchor section into
// its own page (2026-09), given room to be a full page instead of one card
// in a scroll. Same content (perks + CTA), just not squeezed. See
// docs/DECISIONS.md for the Home-trim reasoning.

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { Eyebrow } from "@/components/marketing/Eyebrow";
import { IconCheck } from "@/components/marketing/icons";

const VENDOR_PERKS = [
  "Free to list — you only pay when you get booked",
  "Jorna matches you to hosts planning the events you serve",
  "Guaranteed payment through escrow on every booking",
  "Set your own rates, availability, and negotiation preferences",
  "One inbox for every client conversation",
];

export default function ForVendorsPage() {
  const { user } = useAuth();

  return (
    <div>
      <section className="px-5 py-16 md:py-24">
        <div className="mx-auto w-[min(var(--container-wide),100%)]">
          <div className="overflow-hidden rounded-2xl bg-maroon shadow-[0_32px_64px_-20px_rgba(74,11,26,0.4)] md:grid md:grid-cols-2">
            <div className="h-56 bg-maroon-deep md:h-auto md:min-h-[420px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/app/img/ceremony.jpg"
                alt="A wedding ceremony set up and ready for guests"
                className="size-full object-cover opacity-70"
              />
            </div>
            <div className="flex flex-col justify-center p-8 md:p-12">
              <Eyebrow>For vendors</Eyebrow>
              <h1 className="serif text-3xl text-ground md:text-5xl">
                List your packages. Get booked. Get paid.
              </h1>
              <p className="mt-4 leading-relaxed text-ground/75 md:text-lg">
                Jorna brings the hosts to you. No chasing leads, no awkward payment
                conversations — every booking is protected and paid through escrow once
                the event is done.
              </p>
              <ul className="mt-8 space-y-3">
                {VENDOR_PERKS.map((perk) => (
                  <li key={perk} className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-gold/25 text-gold">
                      {IconCheck}
                    </span>
                    <span className="text-sm text-ground/85">{perk}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link
                  href={user ? "/vendor-onboarding" : "/login?mode=register&role=vendor"}
                  className="inline-flex items-center justify-center rounded-full bg-ground px-7 py-3.5 font-semibold text-maroon transition hover:brightness-95"
                >
                  Become a vendor
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
