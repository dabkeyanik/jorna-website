"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import {
  createService,
  deleteService,
  deleteServiceImage,
  getMyVendor,
  listServices,
  listVendorCategories,
  updateService,
  uploadServiceImages,
  type ServiceInput,
} from "@/lib/jorna";
import {
  priceUnitLabel,
  type ServiceItem,
  type TaxonomyCategory,
  type VendorDetail,
} from "@/lib/types";
import { Button, Card, Field, LinkButton } from "@/components/ui";

function money(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

// The rate's multiplier. "event" is a flat price — everything else needs a
// quantity from the client at booking time before it can be paid.
const PRICE_UNITS = [
  { value: "event", label: "Flat price per event" },
  { value: "person", label: "Per person" },
  { value: "hour", label: "Per hour" },
  { value: "day", label: "Per day" },
];

const blank: ServiceInput = {
  name: "",
  price: 0,
  experience: "",
  price_unit: "event",
  description: "",
  negotiable: false,
};

export default function MyServicesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<ServiceInput>(blank);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/my-services");
  }, [authLoading, user, router]);

  async function refresh(vendorId: string) {
    const res = await listServices({ vendor_id: vendorId, limit: 100 });
    setServices(res.items);
  }

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([getMyVendor(), listVendorCategories()])
      .then(async ([mine, tax]) => {
        if (cancelled) return;
        setVendor(mine);
        setCategories(tax.categories);
        if (mine) await refresh(mine.vendor_id);
      })
      .catch((err) =>
        !cancelled &&
        setError(err instanceof ApiError ? err.message : "Couldn't load your services."),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user]);

  const subOptions =
    categories.find((c) => c.value === form.category)?.subcategories ?? [];
  const isVenue = form.category === "venue";

  function startNew() {
    // Default to what this vendor does, so most services need no category fiddling.
    setForm({ ...blank, category: vendor?.category ?? "", subcategory: vendor?.subcategory ?? "" });
    setEditing("new");
    setError(null);
  }

  function startEdit(s: ServiceItem) {
    setForm({
      name: s.name,
      price: s.price,
      experience: s.experience ?? "",
      price_unit: s.price_unit ?? "event",
      category: s.category ?? "",
      subcategory: s.subcategory ?? "",
      description: s.description ?? "",
      negotiable: Boolean(s.negotiable),
      location: s.location ?? "",
      venue_latitude: s.venue_latitude ?? null,
      venue_longitude: s.venue_longitude ?? null,
    });
    setEditing(s.service_id);
    setError(null);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("This browser can't share a location — enter the coordinates manually.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setForm((f) => ({
          ...f,
          venue_latitude: Number(pos.coords.latitude.toFixed(6)),
          venue_longitude: Number(pos.coords.longitude.toFixed(6)),
        })),
      () => setError("Couldn't read your location. Enter the coordinates manually."),
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!vendor) return;
    if (isVenue && (form.venue_latitude == null || form.venue_longitude == null)) {
      setError(
        "A venue needs its map coordinates — that's what vendor check-in is measured against.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload: ServiceInput = {
        ...form,
        price: Number(form.price),
        subcategory: form.subcategory || null,
        location: form.location || null,
      };
      if (editing === "new") await createService(payload);
      else if (editing) await updateService(editing, payload);
      await refresh(vendor.vendor_id);
      setEditing(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that service.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(serviceId: string) {
    if (!vendor) return;
    setBusy(true);
    try {
      await deleteService(serviceId);
      await refresh(vendor.vendor_id);
      setConfirmDelete(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete that service.");
    } finally {
      setBusy(false);
    }
  }

  async function addPhotos(serviceId: string, files: FileList | null) {
    if (!files?.length || !vendor) return;
    setUploadingFor(serviceId);
    setError(null);
    try {
      await uploadServiceImages(serviceId, Array.from(files));
      await refresh(vendor.vendor_id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't upload those photos.");
    } finally {
      setUploadingFor(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function removePhoto(serviceId: string, url: string) {
    if (!vendor) return;
    try {
      await deleteServiceImage(serviceId, url);
      await refresh(vendor.vendor_id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove that photo.");
    }
  }

  if (authLoading || !user || loading) {
    return <p className="py-20 text-center text-ink-soft">Loading…</p>;
  }

  // Services hang off a vendor profile, so that has to exist first.
  if (!vendor) {
    return (
      <div className="mx-auto w-[min(560px,100%-2rem)] py-20 text-center">
        <h1 className="serif text-3xl text-maroon dark:text-gold">
          Set up your vendor profile first
        </h1>
        <p className="mt-3 text-ink-soft">
          Your services live under your vendor profile — tell us what you do, then
          list what you offer.
        </p>
        <LinkButton href="/vendor-profile" className="mt-6">
          Create vendor profile
        </LinkButton>
      </div>
    );
  }

  return (
    <div className="mx-auto w-[min(880px,100%-2rem)] py-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="eyebrow">Selling</span>
          <h1 className="serif mt-3 text-4xl text-maroon dark:text-gold sm:text-5xl">
            Your services
          </h1>
          <p className="mt-2 text-ink-soft">
            What clients can book. Each one has its own price and terms.
          </p>
        </div>
        {editing === null ? <Button onClick={startNew}>Add a service</Button> : null}
      </header>

      {error ? (
        <p className="mt-6 rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
          {error}
        </p>
      ) : null}

      {editing !== null ? (
        <Card className="mt-7 p-6">
          <h2 className="serif text-xl text-ink">
            {editing === "new" ? "New service" : "Edit service"}
          </h2>
          <form onSubmit={save} className="mt-4 grid gap-4">
            <Field
              label="Service name"
              placeholder="Full-Day Wedding Coverage"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Price"
                type="number"
                min={0}
                step="0.01"
                required
                value={form.price || ""}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              />
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink-soft">
                  Priced by
                </span>
                <select
                  value={form.price_unit ?? "event"}
                  onChange={(e) => setForm({ ...form, price_unit: e.target.value })}
                  className="w-full rounded-xl border border-card-edge bg-ground-2 px-3.5 py-2.5 text-ink outline-none focus:border-gold"
                >
                  {PRICE_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-ink-faint">
                  Anything but a flat price needs the client&apos;s guest count or
                  dates before they can pay.
                </span>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink-soft">
                  Category
                </span>
                <select
                  required
                  value={form.category ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value, subcategory: "" })
                  }
                  className="w-full rounded-xl border border-card-edge bg-ground-2 px-3.5 py-2.5 text-ink outline-none focus:border-gold"
                >
                  <option value="" disabled>
                    Choose
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
                    value={form.subcategory ?? ""}
                    onChange={(e) => setForm({ ...form, subcategory: e.target.value })}
                    className="w-full rounded-xl border border-card-edge bg-ground-2 px-3.5 py-2.5 text-ink outline-none focus:border-gold"
                  >
                    <option value="">None</option>
                    {subOptions.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            <Field
              label="Experience"
              placeholder="9+ years"
              required
              value={form.experience}
              onChange={(e) => setForm({ ...form, experience: e.target.value })}
            />

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-soft">
                Description
              </span>
              <textarea
                rows={3}
                value={form.description ?? ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What's included."
                className="w-full rounded-xl border border-card-edge bg-ground-2 px-3.5 py-2.5 text-ink outline-none focus:border-gold"
              />
            </label>

            {isVenue ? (
              <div className="rounded-xl bg-panel p-4">
                <p className="text-sm font-medium text-ink">Where is it?</p>
                <p className="mt-1 text-xs text-ink-faint">
                  A venue anchors the whole event — its map pin is what vendor
                  check-in is measured against, so it&apos;s required.
                </p>
                <div className="mt-3 grid gap-3">
                  <Field
                    label="Address"
                    required
                    value={form.location ?? ""}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      label="Latitude"
                      type="number"
                      step="any"
                      required
                      value={form.venue_latitude ?? ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          venue_latitude: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                    <Field
                      label="Longitude"
                      type="number"
                      step="any"
                      required
                      value={form.venue_longitude ?? ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          venue_longitude: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                  <Button type="button" variant="ghost" size="md" onClick={useMyLocation}>
                    Use my current location
                  </Button>
                </div>
              </div>
            ) : null}

            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={Boolean(form.negotiable)}
                onChange={(e) => setForm({ ...form, negotiable: e.target.checked })}
                className="mt-1"
              />
              <span className="text-sm text-ink-soft">
                Open to offers on this service
                <span className="block text-xs text-ink-faint">
                  Clients can propose a price and you settle it before booking.
                </span>
              </span>
            </label>

            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : editing === "new" ? "Add service" : "Save changes"}
              </Button>
              <Button variant="ghost" type="button" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {services.length === 0 && editing === null ? (
        <p className="mt-12 text-center text-ink-soft">
          No services yet. Clients can&apos;t book you until you list at least one.
        </p>
      ) : (
        <div className="mt-8 grid gap-3">
          {services.map((s) => {
            const unit = priceUnitLabel(s.price_unit);
            return (
              <Card key={s.service_id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="serif text-lg text-ink">{s.name}</h3>
                    <p className="mt-0.5 text-sm text-ink-soft">
                      {money(s.price)} {unit}
                      {s.negotiable ? " · open to offers" : ""}
                    </p>
                    {s.description ? (
                      <p className="mt-1 text-sm text-ink-faint">{s.description}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="ghost" size="md" onClick={() => startEdit(s)}>
                      Edit
                    </Button>
                    <Button
                      variant="quiet"
                      size="md"
                      onClick={() => setConfirmDelete(s.service_id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                {/* Photos */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {(s.media ?? []).map((url) => (
                    <div key={url} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt=""
                        className="size-16 rounded-lg object-cover"
                        loading="lazy"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(s.service_id, url)}
                        className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-maroon text-xs text-ground"
                        aria-label="Remove photo"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <label className="cursor-pointer rounded-lg border border-dashed border-card-edge px-3 py-2 text-xs text-ink-soft hover:border-gold">
                    {uploadingFor === s.service_id ? "Uploading…" : "+ Add photos"}
                    <input
                      ref={fileInput}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => addPhotos(s.service_id, e.target.files)}
                    />
                  </label>
                </div>

                {confirmDelete === s.service_id ? (
                  <div className="mt-3 rounded-lg bg-panel p-3">
                    <p className="text-xs text-ink-soft">
                      Delete {s.name}? Clients won&apos;t be able to book it.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="md"
                        disabled={busy}
                        onClick={() => remove(s.service_id)}
                      >
                        {busy ? "Deleting…" : "Delete"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="md"
                        onClick={() => setConfirmDelete(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
