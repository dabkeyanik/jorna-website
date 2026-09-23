import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "For vendors — Jorna",
  description:
    "List your packages, get matched to hosts planning the events you serve, and get paid through escrow on every booking.",
};

export default function ForVendorsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
