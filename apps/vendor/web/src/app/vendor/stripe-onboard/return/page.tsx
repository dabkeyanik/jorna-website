"use client";

// Where Stripe sends a web vendor after Connect onboarding.
//
// The path isn't ours to choose: the backend builds it as
// `{WEB_APP_URL}/vendor/stripe-onboard/return`, so this route has to exist at
// exactly that path or the vendor lands on a 404 having just finished setup.
// It only forwards to Earnings, which re-checks the live Stripe status.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StripeOnboardReturnPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/my-earnings?stripe=return");
  }, [router]);

  return (
    <p className="py-20 text-center text-ink-soft">
      Finishing payment setup…
    </p>
  );
}
