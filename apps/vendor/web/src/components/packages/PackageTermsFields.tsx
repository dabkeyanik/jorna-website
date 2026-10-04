"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { Field } from "@jorna/shared/components/ui";
import type { VendorDetail } from "@/lib/types";
import type { FormState } from "./packageForm";

/** Per-package contract terms, folded away. Blank means the vendor's
 *  defaults from Contracts → Defaults, shown as placeholders so it's clear
 *  what "blank" means. */
export function PackageTermsFields({
  form,
  setForm,
  vendor,
  initiallyOpen,
}: {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  vendor: VendorDetail;
  /** Open when the package already has terms of its own. */
  initiallyOpen: boolean;
}) {
  const [showTerms, setShowTerms] = useState(initiallyOpen);
  return (
    <div className="rounded-xl bg-panel p-4">
      <button
        type="button"
        onClick={() => setShowTerms((v) => !v)}
        aria-expanded={showTerms}
        className="text-sm font-medium text-ink"
      >
        {showTerms ? "▾" : "▸"} Custom contract terms for this package
      </button>
      {showTerms ? (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field
            label="Deposit (%)"
            inputMode="numeric"
            placeholder={vendor.default_deposit_percent?.toString() ?? "—"}
            value={form.deposit_percent}
            onChange={(e) => setForm({ ...form, deposit_percent: e.target.value })}
          />
          <Field
            label="Cancellation window (days)"
            inputMode="numeric"
            placeholder={
              vendor.default_cancellation_window_hours != null
                ? String(Math.round(vendor.default_cancellation_window_hours / 24))
                : "—"
            }
            value={form.cancellation_days}
            onChange={(e) => setForm({ ...form, cancellation_days: e.target.value })}
          />
          <Field
            label="Overtime rate ($/hr)"
            inputMode="decimal"
            placeholder={
              vendor.default_overtime_rate_cents != null
                ? String(vendor.default_overtime_rate_cents / 100)
                : "—"
            }
            value={form.overtime_rate}
            onChange={(e) => setForm({ ...form, overtime_rate: e.target.value })}
          />
          <p className="text-xs text-ink-faint sm:col-span-3">
            Leave blank to use your defaults. New contracts for this package start
            from these.
          </p>
        </div>
      ) : null}
    </div>
  );
}
