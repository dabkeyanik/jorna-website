// Vendors read their messages inside the vendor sidebar; clients get the
// shared header as before. See VendorShellIfVendor.
import { VendorShellIfVendor } from "@/components/VendorShellIfVendor";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <VendorShellIfVendor>{children}</VendorShellIfVendor>;
}
