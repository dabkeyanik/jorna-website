// The vendor-shell route group: everything under here renders inside the
// persistent sidebar (VendorSidebar) instead of the shared marketing/
// marketplace header (SiteHeader, hidden on these routes by ChromeGate).
// A route group adds no URL segment, so /my-dashboard, /my-bookings,
// /contracts/new, /clients and /vendor-profile keep their existing URLs.
import { VendorSidebar } from "@/components/VendorSidebar";

export default function VendorShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <VendorSidebar>{children}</VendorSidebar>;
}
