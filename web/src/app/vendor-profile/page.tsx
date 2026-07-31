"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import {
  createVendor,
  getMyVendor,
  getVendorReviews,
  listServices,
  listVendorCategories,
  updateMyVendor,
} from "@/lib/jorna";
import type {
  Review,
  ServiceItem,
  TaxonomyCategory,
  VendorDetail,
} from "@/lib/types";
import { Button, Card, Field, LinkButton, Stars } from "@/components/ui";
import { VendorNav } from "@/components/VendorNav";
import { ServicesManager } from "@/components/ServicesManager";

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
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [radius, setRadius] = useState("");
  const [longDistance, setLongDistance] = useState(false);
  const [locationNegotiable, setLocationNegotiable] = useState(false);
  const [instagram, setInstagram] = useState("");

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/vendor-profile");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([listVendorCategories(), getMyVendor()])
      .then(async ([tax, mine]) => {
        if (cancelled) return;
        setCategories(tax.categories);
        setVendor(mine);
        if (mine) {
          setBio(mine.bio ?? "");
          setCategory(mine.category ?? "");
          setSubcategory(mine.subcategory ?? "");
          setRadius(mine.travel_radius_miles?.toString() ?? "");
          setLongDistance(Boolean(mine.open_to_long_distance));
          setLocationNegotiable(Boolean(mine.open_to_price_negotiation));
          setInstagram(mine.instagram_username ?? "");
          // Both best-effort: the profile stays editable when either fails.
          const [r, svc] = await Promise.all([
            getVendorReviews(mine.vendor_id).catch(() => null),
            listServices({ vendor_id: mine.vendor_id, limit: 100 }).catch(() => null),
          ]);
          if (cancelled) return;
          if (r) setReviews(r.items);
          if (svc) setServices(svc.items);
        }
      })
      .catch((err) =>
        !cancelled &&
        setError(err instanceof ApiError ? err.message : "Couldn't load your profile."),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Subcategories are per-category and validated server-side, so reset the
  // choice whenever the category changes rather than sending a stale pair.
  const subOptions = categories.find((c) => c.value === category)?.subcategories ?? [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      if (vendor) {
        const updated = await updateMyVendor({
          bio,
          category,
          subcategory: subcategory || null,
          travel_radius_miles: radius ? Number(radius) : null,
          open_to_long_distance: longDistance,
          open_to_price_negotiation: locationNegotiable,
          instagram_username: instagram.trim().replace(/^@/, "") || null,
        });
        setVendor(updated);
      } else {
        // No category. Signing up is about who you are; what you sell is each
        // service's own category, chosen when the service is added.
        const created = await createVendor({ bio });
        setVendor(created);
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your profile.");
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || !user || loading) {
    return <p className="py-20 text-center text-ink-soft">Loading…</p>;
  }

  return (
    <div className="mx-auto w-[min(680px,100%-2rem)] py-10">
      <VendorNav />
      {/* Everything a client sees, in one place: what you sell, who you are,
          and what people have said. Services used to be a page of their own,
          so setting up meant finding two — and neither was the whole listing. */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="eyebrow">{vendor ? "Selling" : "Become a vendor"}</span>
          <h1 className="serif mt-3 text-4xl text-maroon dark:text-gold">
            {vendor ? "Your listing" : "Create your vendor profile"}
          </h1>
          <p className="mt-3 text-ink-soft">
            {vendor
              ? "What clients see when they find you in search or an AI bundle."
              : "Who you are, so clients know who they're booking. What you sell comes next, one service at a time."}
          </p>
        </div>
        {vendor ? (
          <LinkButton
            href={`/vendor?id=${vendor.vendor_id}`}
            variant="ghost"
            size="md"
            className="shrink-0"
          >
            See what clients see
          </LinkButton>
        ) : null}
      </header>

      {/* Services first: a price change or a new photo is a weekly job, and the
          details below are set once. It also puts the listing-health "add a
          service" link on the page's main content rather than under a form. */}
      {vendor ? (
        <ServicesManager
          vendor={vendor}
          categories={categories}
          initial={services}
        />
      ) : null}

      {vendor ? (
        <h2 className="serif mt-10 text-2xl text-ink">About your business</h2>
      ) : null}
      <Card className="mt-5 p-6">
        <form onSubmit={submit} className="grid gap-4">
          {/* Only once they exist. Signing up asks who you are; what you sell
              is decided per service, where it can differ per service — a DJ who
              also does lighting had to pick one here and was findable under
              only that one. Kept on the edit form because it still seeds a new
              service's category and still reads as a headline on the profile. */}
          {vendor ? (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-soft">
                Your main category
              </span>
              <select
                required
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setSubcategory("");
                }}
                className="w-full rounded-xl border border-card-edge bg-ground-2 px-3.5 py-2.5 text-ink outline-none focus:border-gold"
              >
                <option value="" disabled>
                  Choose a category
                </option>
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-ink-faint">
                How you&apos;re listed. Each service you add gets its own
                category, and starts from this one.
              </span>
            </label>
          ) : null}

          {vendor && subOptions.length > 0 ? (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-soft">
                Speciality
              </span>
              <select
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                className="w-full rounded-xl border border-card-edge bg-ground-2 px-3.5 py-2.5 text-ink outline-none focus:border-gold"
              >
                <option value="">No speciality</option>
                {subOptions.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-ink-faint">
                Clients filter by this — a DJ slot only shows DJs.
              </span>
            </label>
          ) : null}

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-soft">
              About you
            </span>
            <textarea
              required
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="What you offer, your style, and what makes your work yours."
              className="w-full rounded-xl border border-card-edge bg-ground-2 px-3.5 py-2.5 text-ink outline-none focus:border-gold"
            />
          </label>

          {vendor ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Travel radius (miles)"
                  type="number"
                  min={0}
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                />
                <Field
                  label="Instagram (optional)"
                  placeholder="yourhandle"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                />
              </div>

              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={longDistance}
                  onChange={(e) => setLongDistance(e.target.checked)}
                  className="mt-1"
                />
                <span className="text-sm text-ink-soft">
                  I&apos;ll travel beyond my radius for the right event
                </span>
              </label>

              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={locationNegotiable}
                  onChange={(e) => setLocationNegotiable(e.target.checked)}
                  className="mt-1"
                />
                <span className="text-sm text-ink-soft">
                  I&apos;m open to discussing price
                  <span className="block text-xs text-ink-faint">
                    Whether a client can actually make an offer is set per service.
                  </span>
                </span>
              </label>
            </>
          ) : null}

          {error ? (
            <p className="rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
              {error}
            </p>
          ) : null}
          {saved ? (
            <p className="rounded-lg bg-green/10 px-3 py-2 text-sm text-green">
              Saved.
            </p>
          ) : null}

          <Button type="submit" size="lg" disabled={busy}>
            {busy ? "Saving…" : vendor ? "Save changes" : "Create vendor profile"}
          </Button>
        </form>
      </Card>

      {/* Reputation, beside the bio and photos it's a consequence of. It was on
          the dashboard, which is otherwise entirely operational — what needs me,
          what's coming, where's my money — and a star rating is none of those.
          Here it sits next to the things a vendor would change in response to
          it. */}
      {vendor && (vendor.rating || reviews.length > 0) ? (
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
