"use client";

// Stripe sends the vendor here when an onboarding link expires or is abandoned.
// Like the return page, the path is fixed by the backend. Send them back to
// Earnings, where "Continue payment setup" mints a fresh link.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StripeOnboardRefreshPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/my-earnings?stripe=refresh");
  }, [router]);

  return (
    <p className="py-20 text-center text-ink-soft">
      That setup link expired — taking you back…
    </p>
  );
}
