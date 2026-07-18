"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import {
  createVendor,
  getMyVendor,
  listVendorCategories,
  updateMyVendor,
} from "@/lib/jorna";
import type { TaxonomyCategory, VendorDetail } from "@/lib/types";
import { Button, Card, Field, LinkButton } from "@/components/ui";

export default function VendorProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
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
      .then(([tax, mine]) => {
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
        const created = await createVendor({
          bio,
          category,
          subcategory: subcategory || null,
        });
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
      <header>
        <span className="eyebrow">{vendor ? "Vendor profile" : "Become a vendor"}</span>
        <h1 className="serif mt-3 text-4xl text-maroon dark:text-gold">
          {vendor ? "Your vendor profile" : "List your services on Jorna"}
        </h1>
        <p className="mt-3 text-ink-soft">
          {vendor
            ? "This is what clients see when they find you in search or an AI bundle."
            : "Tell clients what you do. You can add your services and prices next."}
        </p>
      </header>

      <Card className="mt-7 p-6">
        <form onSubmit={submit} className="grid gap-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-soft">
              What do you do?
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
          </label>

          {subOptions.length > 0 ? (
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

      {vendor ? (
        <div className="mt-6 rounded-2xl border border-card-edge bg-panel p-5">
          <p className="text-sm text-ink-soft">
            Next: list what you offer and set your prices. Clients can&apos;t book
            you until you have at least one service.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <LinkButton href={`/vendor?id=${vendor.vendor_id}`} variant="ghost">
              View public profile
            </LinkButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
