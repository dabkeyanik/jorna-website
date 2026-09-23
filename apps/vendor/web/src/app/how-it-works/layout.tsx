// A layout rather than metadata on the page itself: page.tsx is a client
// component, and those can't export metadata — see home/layout.tsx for the
// same pattern.

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How it works — Jorna",
  description:
    "Describe your celebration, compare three complete vendor teams, and book with your payment held safely in escrow.",
};

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
