"use client";

// The vendor-identity form fields, shared between /vendor-onboarding (where
// they're asked once, in order) and /vendor-profile's ongoing edit form
// (where they're all just settings). One copy so wording and validation can't
// drift between the two.

import { useState } from "react";
import { ESCROW_ENABLED } from "@/lib/flags";
import type { ContractTerms, TaxonomyCategory, VendorDetail, VendorSpecialization } from "@/lib/types";
import { Chip, Field } from "./ui";

function specKey(s: VendorSpecialization): string {
  return `${s.category}:${s.subcategory ?? ""}`;
}

function specLabel(s: VendorSpecialization, categories: TaxonomyCategory[]): string {
  const cat = categories.find((c) => c.value === s.category);
  const sub = cat?.subcategories.find((o) => o.value === s.subcategory);
  return sub ? `${cat?.label ?? s.category} · ${sub.label}` : cat?.label ?? s.category;
}

export function VendorIdentityFields({
  categories,
  specializations,
  bio,
  onSpecializationsChange,
  onBioChange,
}: {
  categories: TaxonomyCategory[];
  specializations: VendorSpecialization[];
  bio: string;
  onSpecializationsChange: (next: VendorSpecialization[]) => void;
  onBioChange: (value: string) => void;
}) {
  // Which category's options are on screen — a picker, not part of the
  // selection itself. Starts on the first thing already picked so reopening
  // this form (settings) doesn't land on an empty picker.
  const [pickerCategory, setPickerCategory] = useState(specializations[0]?.category ?? "");
  const pickerCat = categories.find((c) => c.value === pickerCategory);
  const subOptions = pickerCat?.subcategories ?? [];

  function has(category: string, subcategory: string | null) {
    return specializations.some(
      (s) => s.category === category && (s.subcategory ?? null) === subcategory,
    );
  }

  function toggle(category: string, subcategory: string | null) {
    if (has(category, subcategory)) {
      onSpecializationsChange(
        specializations.filter(
          (s) => !(s.category === category && (s.subcategory ?? null) === subcategory),
        ),
      );
    } else {
      onSpecializationsChange([...specializations, { category, subcategory }]);
    }
  }

  function remove(target: VendorSpecialization) {
    onSpecializationsChange(specializations.filter((s) => specKey(s) !== specKey(target)));
  }

  return (
    <>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-soft">
          Add a category
        </span>
        <select
          value={pickerCategory}
          onChange={(e) => setPickerCategory(e.target.value)}
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
          Pick every category you sell in, then any specialities within it —
          each package you add still gets its own, starting from these.
        </span>
      </label>

      {pickerCat ? (
        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink-soft">
            What you offer in {pickerCat.label}
          </span>
          <div className="flex flex-wrap gap-2">
            <Chip
              active={has(pickerCat.value, null)}
              onClick={() => toggle(pickerCat.value, null)}
            >
              {pickerCat.label}
            </Chip>
            {subOptions.map((s) => (
              <Chip
                key={s.value}
                active={has(pickerCat.value, s.value)}
                onClick={() => toggle(pickerCat.value, s.value)}
              >
                {s.label}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <span className="mb-1.5 block text-sm font-medium text-ink-soft">
          Your specializations
        </span>
        {specializations.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {specializations.map((s) => (
              <span
                key={specKey(s)}
                className="inline-flex items-center gap-1.5 rounded-full bg-gold/12 py-1 pl-3 pr-1.5 text-xs font-semibold text-maroon dark:text-gold"
              >
                {specLabel(s, categories)}
                <button
                  type="button"
                  onClick={() => remove(s)}
                  aria-label={`Remove ${specLabel(s, categories)}`}
                  className="relative grid size-4 place-items-center rounded-full after:absolute after:-inset-3 after:content-[''] hover:bg-maroon/15 dark:hover:bg-gold/20"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink-faint">
            Pick at least one category above — clients filter by this.
          </p>
        )}
      </div>

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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label="Travel radius (miles)"
          type="number"
          min={1}
          max={500}
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
            Whether a client can actually make an offer is set per package.
          </span>
        </span>
      </label>
    </>
  );
}

/** How this vendor gets paid. With escrow disabled (the MVP default — see
 *  lib/flags.ts) this is just the Venmo/Zelle fields, no choice to make;
 *  callers always pass "manual" in that case. Stripe Connect's own
 *  onboarding status is a separate, live-fetched thing (see /my-earnings),
 *  not part of this form. */
export function VendorPaymentFields({
  paymentMethod,
  venmoHandle,
  zelleContact,
  onPaymentMethodChange,
  onVenmoHandleChange,
  onZelleContactChange,
}: {
  paymentMethod: "stripe" | "manual";
  venmoHandle: string;
  zelleContact: string;
  onPaymentMethodChange: (value: "stripe" | "manual") => void;
  onVenmoHandleChange: (value: string) => void;
  onZelleContactChange: (value: string) => void;
}) {
  // With escrow disabled, manual is the only option — treated as such here
  // regardless of what a not-yet-updated vendor row still has stored, so a
  // legacy "stripe" vendor still sees (and can fill in) the Venmo/Zelle
  // fields rather than being shown nothing with no way to switch.
  const effectivePaymentMethod = ESCROW_ENABLED ? paymentMethod : "manual";

  return (
    <>
      {ESCROW_ENABLED ? (
        <div className="grid gap-2.5 sm:grid-cols-2">
          <label
            className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3.5 transition ${
              paymentMethod === "stripe" ? "border-gold bg-gold/8" : "border-card-edge bg-ground-2"
            }`}
          >
            <input
              type="radio"
              name="payment_method"
              checked={paymentMethod === "stripe"}
              onChange={() => onPaymentMethodChange("stripe")}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium text-ink">Protected — through Jorna</span>
              <span className="mt-0.5 block text-xs text-ink-faint">
                Clients pay by card. Jorna holds the funds and covers cancellations under
                Jorna&apos;s policy.
              </span>
            </span>
          </label>
          <label
            className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3.5 transition ${
              paymentMethod === "manual" ? "border-gold bg-gold/8" : "border-card-edge bg-ground-2"
            }`}
          >
            <input
              type="radio"
              name="payment_method"
              checked={paymentMethod === "manual"}
              onChange={() => onPaymentMethodChange("manual")}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium text-ink">Direct — Venmo or Zelle</span>
              <span className="mt-0.5 block text-xs text-ink-faint">
                Clients pay you directly, no card fees — but Jorna can&apos;t hold, refund, or
                mediate this payment.
              </span>
            </span>
          </label>
        </div>
      ) : null}

      {effectivePaymentMethod === "manual" ? (
        <div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Venmo handle"
              placeholder="@your-business"
              value={venmoHandle}
              onChange={(e) => onVenmoHandleChange(e.target.value)}
            />
            <Field
              label="Zelle contact"
              placeholder="you@business.com or a phone number"
              value={zelleContact}
              onChange={(e) => onZelleContactChange(e.target.value)}
            />
          </div>
          {!ESCROW_ENABLED ? (
            <p className="mt-1.5 text-xs text-ink-faint">
              Add at least one so clients know how to pay you.
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/** Defaults that seed a new Contracts-builder booking — a vendor sets these
 *  once instead of re-typing the same deposit %/cancellation window/
 *  overtime rate into every booking. Purely a starting point: the builder
 *  lets each one be overridden per booking, and nothing here is read by
 *  the backend beyond being returned on GET /vendors/me. */
const GUEST_COUNT_MODES: { value: NonNullable<VendorDetail["default_guest_count_mode"]>; label: string }[] = [
  { value: "optional", label: "Optional — client may skip it" },
  { value: "required", label: "Required — client must enter it" },
  { value: "not_applicable", label: "Not applicable — don't ask" },
];

export function VendorContractDefaultsFields({
  depositPercent,
  cancellationWindowHours,
  overtimeRate,
  equipmentPower,
  travel,
  guestCountMode,
  onDepositPercentChange,
  onCancellationWindowHoursChange,
  onOvertimeRateChange,
  onEquipmentPowerChange,
  onTravelChange,
  onGuestCountModeChange,
}: {
  depositPercent: string;
  cancellationWindowHours: string;
  overtimeRate: string;
  equipmentPower: string;
  travel: string;
  guestCountMode: NonNullable<VendorDetail["default_guest_count_mode"]>;
  onDepositPercentChange: (value: string) => void;
  onCancellationWindowHoursChange: (value: string) => void;
  onOvertimeRateChange: (value: string) => void;
  onEquipmentPowerChange: (value: string) => void;
  onTravelChange: (value: string) => void;
  onGuestCountModeChange: (value: NonNullable<VendorDetail["default_guest_count_mode"]>) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field
          label="Default deposit (%)"
          type="number"
          min={0}
          max={100}
          placeholder="e.g. 50"
          value={depositPercent}
          onChange={(e) => onDepositPercentChange(e.target.value)}
        />
        <Field
          label="Cancellation window (hours)"
          type="number"
          min={0}
          placeholder="e.g. 720"
          value={cancellationWindowHours}
          onChange={(e) => onCancellationWindowHoursChange(e.target.value)}
        />
        <Field
          label="Overtime rate ($/hr)"
          type="number"
          min={0}
          step="0.01"
          value={overtimeRate}
          onChange={(e) => onOvertimeRateChange(e.target.value)}
        />
      </div>
      <Field
        label="Equipment & power (optional)"
        placeholder="Vendor brings all gear; venue provides standard power"
        value={equipmentPower}
        onChange={(e) => onEquipmentPowerChange(e.target.value)}
      />
      <Field
        label="Travel (optional)"
        placeholder="30 miles included, $0.75/mi beyond"
        value={travel}
        onChange={(e) => onTravelChange(e.target.value)}
      />
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-soft">
          Guest count mode for new bookings
        </span>
        <select
          value={guestCountMode}
          onChange={(e) =>
            onGuestCountModeChange(e.target.value as NonNullable<VendorDetail["default_guest_count_mode"]>)
          }
          className="w-full rounded-xl border border-card-edge bg-ground-2 px-3.5 py-2.5 text-ink outline-none focus:border-gold sm:w-auto"
        >
          {GUEST_COUNT_MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-ink-faint">
        Just a starting point — every new booking in Contracts can still change these.
      </p>
    </>
  );
}

/** Round-trip helpers for VendorContractDefaultsFields, shared by every
 *  caller so the dollars-vs-cents conversion can't drift between them. */
export function contractDefaultsToStrings(vendor: {
  default_deposit_percent?: number | null;
  default_cancellation_window_hours?: number | null;
  default_overtime_rate_cents?: number | null;
  default_contract_terms?: ContractTerms | null;
  default_guest_count_mode?: VendorDetail["default_guest_count_mode"];
}) {
  return {
    depositPercent: vendor.default_deposit_percent?.toString() ?? "",
    cancellationWindowHours: vendor.default_cancellation_window_hours?.toString() ?? "",
    overtimeRate:
      vendor.default_overtime_rate_cents != null
        ? (vendor.default_overtime_rate_cents / 100).toString()
        : "",
    equipmentPower: vendor.default_contract_terms?.equipment_power ?? "",
    travel: vendor.default_contract_terms?.travel ?? "",
    guestCountMode: vendor.default_guest_count_mode ?? "optional",
  };
}
