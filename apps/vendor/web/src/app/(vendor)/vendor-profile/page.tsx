"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@jorna/shared/lib/api";
import {
  getMyVendor,
  getVendorReviews,
  listMyServices,
  listVendorCategories,
  updateMyVendor,
} from "@/lib/jorna";
import {
  categoryLabel,
  vendorSpecializations,
  type Review,
  type ServiceItem,
  type TaxonomyCategory,
  type VendorDetail,
  type VendorSpecialization,
} from "@/lib/types";
type GuestCountMode = NonNullable<VendorDetail["default_guest_count_mode"]>;
import { Avatar, Button, Card, LinkButton, Stars } from "@jorna/shared/components/ui";
import { ServicesManager, type ServicesManagerHandle } from "@/components/ServicesManager";
import { PageHeader, PrimaryAction } from "@/components/vendor/ui";
import { AvailabilityFields } from "@/components/AvailabilityFields";
import {
  VendorIdentityFields,
  VendorReachFields,
  VendorContractDefaultsFields,
  contractDefaultsToStrings,
} from "@/components/VendorProfileFields";

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
  const packagesRef = useRef<ServicesManagerHandle>(null);
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
  const [depositPercent, setDepositPercent] = useState("");
  const [cancellationWindowHours, setCancellationWindowHours] = useState("");
  const [overtimeRate, setOvertimeRate] = useState("");
  const [equipmentPower, setEquipmentPower] = useState("");
  const [travel, setTravel] = useState("");
  const [guestCountMode, setGuestCountMode] = useState<GuestCountMode>("optional");

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/vendor-profile&role=vendor");
  }, [authLoading, user, router]);

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
        // Left out when blank: the backend rejects an explicit null (it
        // validates any radius it's sent as 1–500), and blank means "not set".
        ...(radius ? { travel_radius_miles: Number(radius) } : {}),
        open_to_long_distance: longDistance,
        open_to_price_negotiation: locationNegotiable,
        instagram_username: instagram.trim().replace(/^@/, "") || null,
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

  const displayName = [vendor.f_name, vendor.l_name].filter(Boolean).join(" ");

  return (
    <div>
      <PageHeader
        eyebrow="Public presence"
        title="Vendor profile"
        subtitle="What couples see when they find you — your packages and your story."
        action={<PrimaryAction onClick={() => packagesRef.current?.startNew()}>Add package</PrimaryAction>}
      />

      {/* The design's identity card: who couples see, and a way to look. */}
      <section className="overflow-hidden rounded-2xl border border-card-edge bg-card shadow-[var(--shadow-card)]">
        <div className="relative h-24 bg-[#641f34] [background-image:radial-gradient(circle_at_85%_20%,#9b5365_0,transparent_40%),radial-gradient(circle_at_10%_100%,#3b0f1b_0,transparent_55%)]" />
        <div className="relative flex flex-wrap items-end justify-between gap-4 px-5 pb-5 pt-12 sm:px-6">
          <div className="absolute -top-9 left-5 rounded-full border-4 border-card sm:left-6">
            <Avatar src={vendor.pfp_url} name={displayName} size={72} />
          </div>
          <div className="min-w-0">
            <strong className="serif block truncate text-xl text-ink">{displayName || "Your business"}</strong>
            <p className="mt-0.5 text-sm text-ink-faint">
              {[vendor.category ? categoryLabel(vendor.subcategory || vendor.category) : null, vendor.location]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <LinkButton href={`/vendor?id=${vendor.vendor_id}`} variant="ghost" size="md" className="shrink-0">
            Preview public profile
          </LinkButton>
        </div>
      </section>

      {/* Services first: a price change or a new photo is a weekly job, and the
          details below are set once. */}
      <ServicesManager ref={packagesRef} vendor={vendor} categories={categories} initial={services} />

      {/* One <form>/submit across every section below — a vendor saves their
          whole listing at once, not section by section. (Payment details moved
          to Settings.) `contents` keeps the <form> itself out of the
          layout so each section can still sit in its own <h2>+<Card>. */}
      <form onSubmit={submit} className="contents">
        <section className="mt-9">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-ink-faint">Profile details</p>
        <h2 className="serif mt-1 text-xl text-ink">About your business</h2>
        <p className="mt-1 text-sm text-ink-soft">Help couples understand your style, story and where you&apos;ll travel.</p>
        <Card className="mt-4 p-6">
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
        </section>

        <h2 className="serif mt-9 text-xl text-ink">Contract defaults</h2>
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

      {/* Availability saves through a different endpoint (setMyAvailability,
          not updateMyVendor) than everything above, so it keeps its own save
          button rather than joining the form. Folded in from the old
          /my-availability route — same page a host filtering by date is
          matched against, so it belongs beside the rest of the listing. */}
      <h2 className="serif mt-9 text-xl text-ink">Availability</h2>
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
