"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { ESCROW_ENABLED } from "@/lib/flags";
import {
  getMyVendor,
  getVendorReviews,
  listMyServices,
  listVendorCategories,
  updateMyVendor,
} from "@/lib/jorna";
import {
  vendorSpecializations,
  type Review,
  type ServiceItem,
  type TaxonomyCategory,
  type VendorDetail,
  type VendorSpecialization,
} from "@/lib/types";
type GuestCountMode = NonNullable<VendorDetail["default_guest_count_mode"]>;
import { Button, Card, LinkButton, Stars } from "@/components/ui";
import { ServicesManager } from "@/components/ServicesManager";
import { AvailabilityFields } from "@/components/AvailabilityFields";
import {
  VendorIdentityFields,
  VendorPaymentFields,
  VendorReachFields,
  VendorContractDefaultsFields,
  contractDefaultsToStrings,
} from "@/components/VendorProfileFields";
import {
  deleteTemplate,
  listTemplates,
  type ContractTemplate,
} from "@/lib/contractTemplates";

function prettyDate(iso?: string | null): string | null {
  if (!iso || iso === "TBD") return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function VendorProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Form
  const [bio, setBio] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [specializations, setSpecializations] = useState<VendorSpecialization[]>([]);
  const [radius, setRadius] = useState("");
  const [longDistance, setLongDistance] = useState(false);
  const [locationNegotiable, setLocationNegotiable] = useState(false);
  const [instagram, setInstagram] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"stripe" | "manual">("stripe");
  const [venmoHandle, setVenmoHandle] = useState("");
  const [zelleContact, setZelleContact] = useState("");
  const [depositPercent, setDepositPercent] = useState("");
  const [cancellationWindowHours, setCancellationWindowHours] = useState("");
  const [overtimeRate, setOvertimeRate] = useState("");
  const [equipmentPower, setEquipmentPower] = useState("");
  const [travel, setTravel] = useState("");
  const [guestCountMode, setGuestCountMode] = useState<GuestCountMode>("optional");
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/vendor-profile&role=vendor");
  }, [authLoading, user, router]);

  useEffect(() => {
    setTemplates(listTemplates());
  }, []);

  function removeTemplate(id: string) {
    deleteTemplate(id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([listVendorCategories(), getMyVendor()])
      .then(async ([tax, mine]) => {
        if (cancelled) return;
        setCategories(tax.categories);
        if (!mine) {
          // Setup isn't done — that's /vendor-onboarding's job now, not a
          // bare-bones form on this page. See that page for why "has a
          // vendor record" alone isn't quite the test it uses for "done";
          // this redirect only needs the coarser "not started at all" case.
          router.replace("/vendor-onboarding");
          return;
        }
        setVendor(mine);
        setBio(mine.bio ?? "");
        setYearsExperience(mine.years_experience?.toString() ?? "");
        setSpecializations(vendorSpecializations(mine));
        setRadius(mine.travel_radius_miles?.toString() ?? "");
        setLongDistance(Boolean(mine.open_to_long_distance));
        setLocationNegotiable(Boolean(mine.open_to_price_negotiation));
        setInstagram(mine.instagram_username ?? "");
        // Escrow disabled → manual regardless of what a not-yet-updated
        // vendor row still says (see VendorPaymentFields' same normalization).
        setPaymentMethod(ESCROW_ENABLED ? (mine.payment_method ?? "stripe") : "manual");
        setVenmoHandle(mine.venmo_handle ?? "");
        setZelleContact(mine.zelle_contact ?? "");
        const defaults = contractDefaultsToStrings(mine);
        setDepositPercent(defaults.depositPercent);
        setCancellationWindowHours(defaults.cancellationWindowHours);
        setOvertimeRate(defaults.overtimeRate);
        setEquipmentPower(defaults.equipmentPower);
        setTravel(defaults.travel);
        setGuestCountMode(defaults.guestCountMode as GuestCountMode);
        // Both best-effort: the profile stays editable when either fails.
        const [r, svc] = await Promise.all([
          getVendorReviews(mine.vendor_id).catch(() => null),
          // Hidden and archived included — this is the vendor's own list.
          listMyServices(mine.vendor_id).catch(() => null),
        ]);
        if (cancelled) return;
        if (r) setReviews(r.items);
        if (svc) setServices(svc.items);
      })
      .catch((err) =>
        !cancelled &&
        setError(err instanceof ApiError ? err.message : "Couldn't load your profile."),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user, router]);

  function updateSpecializations(next: VendorSpecialization[]) {
    setSpecializations(next);
    if (next.length > 0) setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (specializations.length === 0) {
      setError("Pick at least one category first.");
      return;
    }
    const trimmedVenmo = venmoHandle.trim();
    const trimmedZelle = zelleContact.trim();
    if (paymentMethod === "manual" && !trimmedVenmo && !trimmedZelle) {
      setError("Add a Venmo handle or Zelle contact so clients know how to pay you directly.");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const [primary] = specializations;
      const updated = await updateMyVendor({
        bio,
        category: primary.category,
        subcategory: primary.subcategory ?? null,
        specializations,
        years_experience: yearsExperience ? Number(yearsExperience) : null,
        travel_radius_miles: radius ? Number(radius) : null,
        open_to_long_distance: longDistance,
        open_to_price_negotiation: locationNegotiable,
        instagram_username: instagram.trim().replace(/^@/, "") || null,
        payment_method: paymentMethod,
        venmo_handle: trimmedVenmo || null,
        zelle_contact: trimmedZelle || null,
        default_deposit_percent: depositPercent ? Number(depositPercent) : null,
        default_cancellation_window_hours: cancellationWindowHours
          ? Number(cancellationWindowHours)
          : null,
        default_overtime_rate_cents: overtimeRate ? Math.round(Number(overtimeRate) * 100) : null,
        default_contract_terms:
          equipmentPower.trim() || travel.trim()
            ? { equipment_power: equipmentPower.trim() || undefined, travel: travel.trim() || undefined }
            : null,
        default_guest_count_mode: guestCountMode,
      });
      setVendor(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your profile.");
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || !user || loading || !vendor) {
    return <p className="py-20 text-center text-ink-soft">Loading…</p>;
  }

  return (
    <div>
      {/* Everything a client sees, in one place: what you sell, who you are,
          and what people have said. Services used to be a page of their own,
          so setting up meant finding two — and neither was the whole listing. */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="eyebrow">Selling</span>
          <h1 className="serif mt-3 text-4xl text-maroon dark:text-gold">Your listing</h1>
          <p className="mt-3 text-ink-soft">
            What clients see when they find you in search or an AI bundle.
          </p>
        </div>
        <LinkButton
          href={`/vendor?id=${vendor.vendor_id}`}
          variant="ghost"
          size="md"
          className="shrink-0"
        >
          See what clients see
        </LinkButton>
      </header>

      {/* Services first: a price change or a new photo is a weekly job, and the
          details below are set once. It also puts the listing-health "add a
          service" link on the page's main content rather than under a form. */}
      <ServicesManager vendor={vendor} categories={categories} initial={services} />

      {/* One <form>/submit across every section below, same as before Payment
          details existed — a vendor saves their whole listing at once, not
          section by section. `contents` keeps the <form> itself out of the
          layout so each section can still sit in its own <h2>+<Card>. */}
      <form onSubmit={submit} className="contents">
        <h2 className="serif mt-10 text-2xl text-ink">About your business</h2>
        <Card className="mt-5 p-6">
          <div className="grid gap-4">
            <VendorIdentityFields
              categories={categories}
              specializations={specializations}
              bio={bio}
              onSpecializationsChange={updateSpecializations}
              onBioChange={setBio}
              yearsExperience={yearsExperience}
              onYearsExperienceChange={setYearsExperience}
            />

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
          </div>
        </Card>

        <h2 className="serif mt-10 text-2xl text-ink">Payment details</h2>
        <Card className="mt-5 p-6">
          <div className="grid gap-4">
            <VendorPaymentFields
              paymentMethod={paymentMethod}
              venmoHandle={venmoHandle}
              zelleContact={zelleContact}
              onPaymentMethodChange={setPaymentMethod}
              onVenmoHandleChange={setVenmoHandle}
              onZelleContactChange={setZelleContact}
            />
          </div>
        </Card>

        <h2 className="serif mt-10 text-2xl text-ink">Contract defaults</h2>
        <Card className="mt-5 p-6">
          <div className="grid gap-4">
            <VendorContractDefaultsFields
              depositPercent={depositPercent}
              cancellationWindowHours={cancellationWindowHours}
              overtimeRate={overtimeRate}
              equipmentPower={equipmentPower}
              travel={travel}
              guestCountMode={guestCountMode}
              onDepositPercentChange={setDepositPercent}
              onCancellationWindowHoursChange={setCancellationWindowHours}
              onOvertimeRateChange={setOvertimeRate}
              onEquipmentPowerChange={setEquipmentPower}
              onTravelChange={setTravel}
              onGuestCountModeChange={setGuestCountMode}
            />
          </div>
        </Card>

        <div className="mt-5 grid gap-4">
          {error ? (
            <p
              role="alert"
              className="rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold"
            >
              {error}
            </p>
          ) : null}
          {saved ? (
            <p className="rounded-lg bg-green/10 px-3 py-2 text-sm text-green">
              Saved.
            </p>
          ) : null}

          <Button type="submit" size="lg" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>

      {/* Not part of the profile save above — these live entirely in this
          browser's localStorage (lib/contractTemplates.ts), not on the
          vendor's account, so there's no endpoint to include them in. See
          HONEYBOOK_PARITY_PLAN.md §1.1 for why that's a deliberate cut. */}
      {templates.length > 0 ? (
        <>
          <h2 className="serif mt-10 text-2xl text-ink">Saved contract templates</h2>
          <Card className="mt-5 p-6">
            <p className="text-sm text-ink-soft">
              Saved on this device — used from the template picker on{" "}
              <span className="font-medium text-ink">Contracts → New booking</span>.
            </p>
            <div className="mt-4 grid gap-2">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-card-edge bg-ground-2 px-3.5 py-2.5"
                >
                  <span className="text-sm font-medium text-ink">{t.name}</span>
                  <Button variant="ghost" size="md" onClick={() => removeTemplate(t.id)}>
                    Delete template
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : null}

      {/* Availability saves through a different endpoint (setMyAvailability,
          not updateMyVendor) than everything above, so it keeps its own save
          button rather than joining the form. Folded in from the old
          /my-availability route — same page a host filtering by date is
          matched against, so it belongs beside the rest of the listing. */}
      <h2 className="serif mt-10 text-2xl text-ink">Availability</h2>
      <Card className="mt-5 p-6">
        <AvailabilityFields />
      </Card>

      {/* Reputation, beside the bio and photos it's a consequence of. It was on
          the dashboard, which is otherwise entirely operational — what needs me,
          what's coming, where's my money — and a star rating is none of those.
          Here it sits next to the things a vendor would change in response to
          it. */}
      {vendor.rating || reviews.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-card-edge bg-card p-5">
          <p className="eyebrow mb-3">How clients rate you</p>
          <div className="flex flex-wrap items-baseline gap-6">
            {vendor.rating ? (
              <div>
                <p className="serif text-4xl text-maroon dark:text-gold">
                  {vendor.rating.toFixed(1)}
                </p>
                <Stars rating={vendor.rating} />
              </div>
            ) : null}
            <div>
              <p className="text-xl font-bold text-ink">{reviews.length}</p>
              <p className="text-xs text-ink-faint">Reviews</p>
            </div>
            {vendor.num_events ? (
              <div>
                <p className="text-xl font-bold text-ink">{vendor.num_events}</p>
                <p className="text-xs text-ink-faint">Events</p>
              </div>
            ) : null}
          </div>

          {reviews.slice(0, 3).map((r) => (
            <div key={r.review_id} className="mt-4 border-t border-line-soft pt-4">
              <div className="flex items-center justify-between gap-3">
                <Stars rating={r.rating} />
                <span className="text-xs text-ink-faint">
                  {r.created_at ? prettyDate(r.created_at.slice(0, 10)) : null}
                </span>
              </div>
              {r.comment ? (
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                  {r.comment}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {/* No "next steps" card. It pointed at the services page and the public
          view — one of which is now this page's own first section, and the
          other a button in the header. Its warning that clients can't book you
          without a service is the services list's empty state, said where the
          service would go. */}
    </div>
  );
}
