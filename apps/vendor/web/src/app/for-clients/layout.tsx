import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "For clients — Jorna",
  description:
    "Every price, deposit and deadline agreed in a signed contract before you pay — then pay your vendor directly, with every payment recorded.",
};

export default function ForClientsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
