import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "For clients — Jorna",
  description:
    "Your payment sits in escrow until after the celebration, released only once you confirm — safe to pay months in advance.",
};

export default function ForClientsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
