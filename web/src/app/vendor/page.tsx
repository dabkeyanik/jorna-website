"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { getVendor, getVendorReviews, listServices } from "@/lib/jorna";
import {
  categoryLabel,
  priceUnitLabel,
  type Review,
  type ServiceItem,
  type VendorDetail,
} from "@/lib/types";
import { Card, LinkButton } from "@/components/ui";

function money(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

function ServiceRow({ service }: { service: ServiceItem }) {
  const unit = priceUnitLabel(service.price_unit);
  const photo = service.media?.[0];
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={service.name}
            loading="lazy"
            className="h-40 w-full object-cover sm:h-auto sm:w-48"
          />
        ) : null}
        <div className="flex flex-1 flex-col p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="serif text-lg text-ink">{service.name}</h3>
            <div className="shrink-0 text-right">
              <p className="serif text-lg text-ink">{money(service.price)}</p>
              {unit ? <p className="text-xs text-ink-faint">{unit}</p> : null}
            </div>
          </div>
          {service.description ? (
            <p className="mt-1.5 text-sm text-ink-soft">{service.description}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {service.category ? (
              <span className="rounded-full border border-card-edge px-2.5 py-1 text-ink-faint">
                {categoryLabel(service.subcategory || service.category)}
              </span>
            ) : null}
            {service.experience ? (
              <span className="rounded-full border border-card-edge px-2.5 py-1 text-ink-faint">
                {service.experience}
              </span>
            ) : null}
            {service.negotiable ? (
              <span className="rounded-full border border-gold/50 px-2.5 py-1 text-gold">
                Open to offers
              </span>
            ) : null}
            <LinkButton
              href={`/book?service=${service.service_id}`}
              size="md"
              className="ml-auto"
            >
              Book this
            </LinkButton>
          </div>
        </div>
      </div>
    </Card>
  );
}

function VendorInner() {
  const params = useSearchParams();
  const vendorId = params.get("id");

  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vendorId) {
      setError("No vendor specified.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getVendor(vendorId),
      listServices({ vendor_id: vendorId, limit: 50 }),
      // Reviews are a nice-to-have — don't fail the page if they error.
      getVendorReviews(vendorId).catch(() => ({ items: [] as Review[] })),
    ])
      .then(([v, s, r]) => {
        if (cancelled) return;
        setVendor(v);
        setServices(s.items);
        setReviews(r.items);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Couldn't load this vendor.",
          );
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  if (loading) return <p className="py-20 text-center text-ink-soft">Loading…</p>;

  if (error || !vendor) {
    return (
      <div className="py-20 text-center">
        <p className="text-ink-soft">{error ?? "Vendor not found."}</p>
        <LinkButton href="/browse" variant="ghost" className="mt-5">
          Back to browse
        </LinkButton>
      </div>
    );
  }

  const name = `${vendor.f_name ?? ""} ${vendor.l_name ?? ""}`.trim();

  return (
    <div className="mx-auto w-[min(1080px,100%-2rem)] py-10">
      <Link href="/browse" className="text-sm text-ink-soft hover:text-ink">
        ← Back to browse
      </Link>

      {/* Header */}
      <header className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
        {vendor.pfp_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={vendor.pfp_url}
            alt={name}
            className="size-28 shrink-0 rounded-2xl object-cover"
          />
        ) : null}
        <div className="min-w-0">
          <h1 className="serif text-4xl text-maroon dark:text-gold">{name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
            {vendor.category ? <span>{categoryLabel(vendor.category)}</span> : null}
            {vendor.location ? <span>· {vendor.location}</span> : null}
            {vendor.rating ? (
              <span className="text-gold">· ★ {vendor.rating.toFixed(1)}</span>
            ) : null}
            {vendor.num_events ? <span>· {vendor.num_events} events</span> : null}
          </p>
        </div>
      </header>

      {vendor.bio ? (
        <p className="mt-5 max-w-[70ch] text-ink-soft">{vendor.bio}</p>
      ) : null}

      {/* Services */}
      <section className="mt-10">
        <h2 className="serif text-2xl text-ink">Services</h2>
        {services.length === 0 ? (
          <p className="mt-3 text-ink-soft">
            This vendor hasn&apos;t listed any services yet.
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            {services.map((s) => (
              <ServiceRow key={s.service_id} service={s} />
            ))}
          </div>
        )}
      </section>

      {/* Reviews */}
      <section className="mt-10">
        <h2 className="serif text-2xl text-ink">Reviews</h2>
        {reviews.length === 0 ? (
          <p className="mt-3 text-ink-soft">No reviews yet.</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {reviews.map((r) => (
              <Card key={r.review_id} className="p-4">
                <p className="text-gold">★ {r.rating.toFixed(1)}</p>
                {r.comment ? (
                  <p className="mt-1 text-sm text-ink-soft">{r.comment}</p>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </section>

      <div className="mt-12 rounded-2xl border border-card-edge bg-panel p-6 text-center">
        <p className="text-ink-soft">
          Want this vendor on your team? Build a bundle and we&apos;ll match them to
          your date and budget.
        </p>
        <LinkButton href="/plan" className="mt-4">
          Build my bundle
        </LinkButton>
      </div>
    </div>
  );
}

export default function VendorPage() {
  return (
    <Suspense fallback={<p className="py-20 text-center text-ink-soft">Loading…</p>}>
      <VendorInner />
    </Suspense>
  );
}
