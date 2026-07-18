import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Jorna — Plan your celebration",
  description:
    "Plan your whole South Asian celebration in one place — a matched team of vendors, booked and paid for safely through escrow.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <AuthProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
