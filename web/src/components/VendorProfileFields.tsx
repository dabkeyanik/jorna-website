"use client";

// The vendor-identity form fields, shared between /vendor-onboarding (where
// they're asked once, in order) and /vendor-profile's ongoing edit form
// (where they're all just settings). One copy so wording and validation can't
// drift between the two.

import type { TaxonomyCategory } from "@/lib/types";
import { Field } from "./ui";

export function VendorIdentityFields({
  categories,
  category,
  subcategory,
  bio,
  onCategoryChange,
  onSubcategoryChange,
  onBioChange,
}: {
  categories: TaxonomyCategory[];
  category: string;
  subcategory: string;
  bio: string;
  onCategoryChange: (value: string) => void;
  onSubcategoryChange: (value: string) => void;
  onBioChange: (value: string) => void;
}) {
  const subOptions = categories.find((c) => c.value === category)?.subcategories ?? [];

  return (
    <>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-soft">
          Your main category
        </span>
        <select
          required
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
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
          How you&apos;re listed. Each service you add gets its own category,
          and starts from this one.
        </span>
      </label>

      {subOptions.length > 0 ? (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-soft">
            Speciality
          </span>
          <select
            value={subcategory}
            onChange={(e) => onSubcategoryChange(e.target.value)}
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
        <span className="mb-1.5 block text-sm font-medium text-ink-soft">About you</span>
        <textarea
          required
          rows={4}
          value={bio}
          onChange={(e) => onBioChange(e.target.value)}
          placeholder="What you offer, your style, and what makes your work yours."
          className="w-full rounded-xl border border-card-edge bg-ground-2 px-3.5 py-2.5 text-ink outline-none focus:border-gold"
        />
      </label>
    </>
  );
}

export function VendorReachFields({
  radius,
  longDistance,
  locationNegotiable,
  instagram,
  onRadiusChange,
  onLongDistanceChange,
  onLocationNegotiableChange,
  onInstagramChange,
}: {
  radius: string;
  longDistance: boolean;
  locationNegotiable: boolean;
  instagram: string;
  onRadiusChange: (value: string) => void;
  onLongDistanceChange: (value: boolean) => void;
  onLocationNegotiableChange: (value: boolean) => void;
  onInstagramChange: (value: string) => void;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Travel radius (miles)"
          type="number"
          min={0}
          value={radius}
          onChange={(e) => onRadiusChange(e.target.value)}
        />
        <Field
          label="Instagram (optional)"
          placeholder="yourhandle"
          value={instagram}
          onChange={(e) => onInstagramChange(e.target.value)}
        />
      </div>

      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={longDistance}
          onChange={(e) => onLongDistanceChange(e.target.checked)}
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
          onChange={(e) => onLocationNegotiableChange(e.target.checked)}
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
  );
}
