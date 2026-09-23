// The vendor-shell route group: everything under here renders inside the
// persistent sidebar (VendorSidebar) instead of the shared marketing/
// marketplace header (SiteHeader, hidden on these routes by ChromeGate).
// A route group adds no URL segment, so every page moved in here (dashboard,
// bookings, contracts, clients, calendar, earnings, settings) kept its URL.
// Messages is shared with clients and gets the sidebar a different way — see
// VendorShellIfVendor.
import { VendorSidebar } from "@/components/VendorSidebar";

export default function VendorShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <VendorSidebar>{children}</VendorSidebar>;
}
