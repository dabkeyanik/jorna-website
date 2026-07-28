"use client";

// The event's address, collected as fields rather than as a sentence.
//
// The old control was a city autocomplete over lib/cities that accepted any
// free text, so "Chicagoo", "tbd" and "" were all equally valid answers and a
// vendor could be sent to any of them. These are the parts of a US address, the
// state is a picker so it can't be misspelt, and the zip is checked for shape.
//
// The backend has no address columns, so the caller composes these into the one
// `location` string it does have — see lib/address.

import {
  addressGaps,
  isValidZip,
  US_STATES,
  type Address,
} from "@/lib/address";

const LABELS: Record<keyof Address, string> = {
  line1: "Street address",
  line2: "Apartment, suite, floor",
  city: "City",
  state: "State",
  zip: "ZIP code",
};

export function AddressFields({
  value,
  onChange,
  /** Shown under the zip when a booked venue supplied it. */
  zipHint,
  /** Fields to mark in red — pass the gaps only after a save is attempted. */
  showGaps = false,
}: {
  value: Address;
  onChange: (next: Address) => void;
  zipHint?: string | null;
  showGaps?: boolean;
}) {
  const gaps = showGaps ? addressGaps(value) : [];
  const bad = (field: keyof Address) => gaps.includes(field);

  const field = (
    key: keyof Address,
    extra: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-soft">
        {LABELS[key]}
        {key === "line2" ? (
          <span className="font-normal text-ink-faint"> (optional)</span>
        ) : null}
      </span>
      <input
        {...extra}
        value={value[key]}
        onChange={(e) => onChange({ ...value, [key]: e.target.value })}
        aria-invalid={bad(key) || undefined}
        className={`w-full rounded-xl border bg-ground-2 px-3.5 py-2.5 text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30 ${
          bad(key) ? "border-maroon dark:border-gold" : "border-card-edge"
        }`}
      />
    </label>
  );

  return (
    <div className="grid gap-3">
      {field("line1", { placeholder: "12 Maple Ave", autoComplete: "address-line1" })}
      {field("line2", { placeholder: "Suite 4", autoComplete: "address-line2" })}

      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        {field("city", { placeholder: "Evanston", autoComplete: "address-level2" })}

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-soft">State</span>
          <select
            value={value.state}
            onChange={(e) => onChange({ ...value, state: e.target.value })}
            autoComplete="address-level1"
            aria-invalid={bad("state") || undefined}
            className={`w-full rounded-xl border bg-ground-2 px-3 py-2.5 text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30 ${
              bad("state") ? "border-maroon dark:border-gold" : "border-card-edge"
            }`}
          >
            <option value="">—</option>
            {US_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code}
              </option>
            ))}
          </select>
        </label>

        <div>
          {field("zip", {
            placeholder: "60201",
            inputMode: "numeric",
            autoComplete: "postal-code",
            maxLength: 10,
          })}
          {zipHint ? (
            <p className="mt-1 text-xs text-ink-faint">From your venue: {zipHint}</p>
          ) : value.zip && !isValidZip(value.zip) ? (
            <p className="mt-1 text-xs text-maroon dark:text-gold">
              Five digits, or ZIP+4.
            </p>
          ) : null}
        </div>
      </div>

      {gaps.length > 0 ? (
        <p className="rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
          Vendors travel to this address — it needs a street, a city, a state and a
          valid ZIP before anyone can be sent to it.
        </p>
      ) : null}
    </div>
  );
}
