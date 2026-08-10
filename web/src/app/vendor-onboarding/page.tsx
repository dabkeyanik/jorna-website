"use client";

// First-time vendor setup, as a sequence rather than a settings page.
//
// /vendor-profile used to do this too — a bio-only "create" form that, once
// submitted, revealed a newly-required category field the vendor hadn't been
// asked for. This page asks for everything in order instead, one save per
// step, and is resumable: reloading mid-setup picks up wherever the vendor's
// own record says they got to. /vendor-profile now assumes setup is already
// done and redirects here if it isn't — see that page for the "done" test
// this one shares (a vendor with at least one service is done, no matter what
// else is unset, since an unpriced radius doesn't stop a booking and a
// missing service does).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import {
  createVendor,
  getMyVendor,
  listServices,
  listVendorCategories,
  updateMyVendor,
} from "@/lib/jorna";
import type { ServiceItem, TaxonomyCategory, VendorDetail } from "@/lib/types";
import { Button, Card, LinkButton } from "@/components/ui";
import { VendorIdentityFields, VendorReachFields } from "@/components/VendorProfileFields";
import { ServicesManager } from "@/components/ServicesManager";

type Step = "identity" | "reach" | "service" | "done";

const STEP_NUMBER: Record<Step, number> = { identity: 1, reach: 2, service: 3, done: 4 };

export default function VendorOnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Null until the initial fetch decides where to resume — rendering nothing
  // for a step until then avoids a flash of "step 1" for a vendor who's
  // actually further along.
  const [step, setStep] = useState<Step | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — identity
  const [bio, setBio] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");

  // Step 2 — reach
  const [radius, setRadius] = useState("");
  const [longDistance, setLongDistance] = useState(false);
  const [locationNegotiable, setLocationNegotiable] = useState(false);
  const [instagram, setInstagram] = useState("");

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/vendor-onboarding");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([listVendorCategories(), getMyVendor()])
      .then(async ([tax, mine]) => {
        if (cancelled) return;
        setCategories(tax.categories);
        if (!mine) {
          setStep("identity");
          return;
        }
        setVendor(mine);
        setBio(mine.bio ?? "");
        setCategory(mine.category ?? "");
        setSubcategory(mine.subcategory ?? "");
        setRadius(mine.travel_radius_miles?.toString() ?? "");
        setLongDistance(Boolean(mine.open_to_long_distance));
        setLocationNegotiable(Boolean(mine.open_to_price_negotiation));
        setInstagram(mine.instagram_username ?? "");

        const svc = await listServices({ vendor_id: mine.vendor_id, limit: 100 }).catch(
          () => null,
        );
        if (cancelled) return;
        if (svc?.items.length) {
          // Already bookable — nothing left for this page to do. A radius or
          // Instagram they skipped isn't unfinished setup, it's a setting;
          // /vendor-profile is where settings live once there's a listing.
          router.replace("/vendor-profile");
          return;
        }
        if (svc) setServices(svc.items);
        setStep("reach");
      })
      .catch(
        (err) =>
          !cancelled &&
          setError(err instanceof ApiError ? err.message : "Couldn't load your profile."),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user, router]);

  async function submitIdentity(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await createVendor({ bio, category, subcategory: subcategory || undefined });
      setVendor(created);
      setStep("reach");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create your vendor profile.");
    } finally {
      setBusy(false);
    }
  }

  async function submitReach(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const updated = await updateMyVendor({
        travel_radius_miles: radius ? Number(radius) : null,
        open_to_long_distance: longDistance,
        open_to_price_negotiation: locationNegotiable,
        instagram_username: instagram.trim().replace(/^@/, "") || null,
      });
      setVendor(updated);
      setStep("service");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || !user || loading || !step) {
    return <p className="py-20 text-center text-ink-soft">Loading…</p>;
  }

  return (
    <div className="mx-auto w-[min(640px,100%-2rem)] py-14">
      {step !== "done" ? (
        <>
          <p className="eyebrow text-center">Step {STEP_NUMBER[step]} of 3</p>
          <div className="mx-auto mt-3 flex max-w-xs gap-1.5" aria-hidden="true">
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className={`h-1.5 flex-1 rounded-full ${
                  n <= STEP_NUMBER[step] ? "bg-gold" : "bg-line-soft"
                }`}
              />
            ))}
          </div>
        </>
      ) : null}

      {step === "identity" ? (
        <>
          <h1 className="serif mt-5 text-center text-4xl text-maroon dark:text-gold">
            What do you sell?
          </h1>
          <p className="mt-2 text-center text-ink-soft">
            So clients know who they&apos;re booking.
          </p>
          <Card className="mt-8 p-6">
            <form onSubmit={submitIdentity} className="grid gap-4">
              <VendorIdentityFields
                categories={categories}
                category={category}
                subcategory={subcategory}
                bio={bio}
                onCategoryChange={(v) => {
                  setCategory(v);
                  setSubcategory("");
                }}
                onSubcategoryChange={setSubcategory}
                onBioChange={setBio}
              />
              {error ? (
                <p className="rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
                  {error}
                </p>
              ) : null}
              <Button type="submit" size="lg" disabled={busy}>
                {busy ? "Saving…" : "Continue"}
              </Button>
            </form>
          </Card>
        </>
      ) : null}

      {step === "reach" ? (
        <>
          <h1 className="serif mt-5 text-center text-4xl text-maroon dark:text-gold">
            Where do you work?
          </h1>
          <p className="mt-2 text-center text-ink-soft">
            Helps clients searching by distance find you. Both optional — skip
            them if you&apos;re not sure yet.
          </p>
          <Card className="mt-8 p-6">
            <form onSubmit={submitReach} className="grid gap-4">
              <VendorReachFields
                radius={radius}
                longDistance={longDistance}
                locationNegotiable={locationNegotiable}
                instagram={instagram}
                onRadiusChange={setRadius}
                onLongDistanceChange={setLongDistance}
                onLocationNegotiableChange={setLocationNegotiable}
                onInstagramChange={setInstagram}
              />
              {error ? (
                <p className="rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
                  {error}
                </p>
              ) : null}
              <Button type="submit" size="lg" disabled={busy}>
                {busy ? "Saving…" : "Continue"}
              </Button>
            </form>
          </Card>
        </>
      ) : null}

      {step === "service" && vendor ? (
        <>
          <h1 className="serif mt-5 text-center text-4xl text-maroon dark:text-gold">
            List your first service
          </h1>
          <p className="mt-2 text-center text-ink-soft">
            What clients can book — a price and a photo are what makes a
            listing worth scrolling past.
          </p>
          <div className="mt-8">
            <ServicesManager
              vendor={vendor}
              categories={categories}
              initial={services}
              autoStartNew
              onServiceAdded={() => setStep("done")}
            />
          </div>
        </>
      ) : null}

      {step === "done" ? (
        <div className="py-10 text-center">
          <p className="eyebrow">You&apos;re live</p>
          <h1 className="serif mt-3 text-4xl text-maroon dark:text-gold">
            Clients can find you now
          </h1>
          <p className="mx-auto mt-3 max-w-md text-ink-soft">
            One thing left: without payment setup, you can be booked but never
            paid — it takes a few minutes with Stripe.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <LinkButton href="/my-earnings" size="lg">
              Set up payments
            </LinkButton>
            <LinkButton href="/vendor-profile" variant="ghost" size="lg">
              Go to your listing
            </LinkButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
