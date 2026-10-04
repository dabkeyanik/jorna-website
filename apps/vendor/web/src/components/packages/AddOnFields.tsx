"use client";

import type { Dispatch, SetStateAction } from "react";
import { Button } from "@jorna/shared/components/ui";
import type { AddOn } from "@/lib/types";
import { ADD_ON_UNITS, type FormState } from "./packageForm";

/** Priced extras a client can add on top of the package. */
export function AddOnFields({ form, setForm }: { form: FormState; setForm: Dispatch<SetStateAction<FormState>> }) {
  return (
    <div>
      <p className="text-sm font-medium text-ink-soft">Add-ons (optional)</p>
      <p className="mt-0.5 text-xs text-ink-faint">
        Extras on top of the package price, like an extra hour or a second photographer.
      </p>
      {form.add_ons.length ? (
        <div className="mt-2 grid gap-2">
          {form.add_ons.map((a, i) => (
            <div key={a.id ?? `new-${i}`} className="flex flex-wrap items-center gap-2">
              <input
                aria-label={`Add-on ${i + 1} name`}
                placeholder="Extra hour"
                value={a.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    add_ons: form.add_ons.map((x, j) =>
                      j === i ? { ...x, name: e.target.value } : x,
                    ),
                  })
                }
                className="min-w-0 flex-1 rounded-xl border border-card-edge bg-ground-2 px-3 py-2 text-sm text-ink outline-none focus:border-gold"
              />
              <input
                aria-label={`Add-on ${i + 1} price`}
                inputMode="decimal"
                placeholder="$"
                value={a.price}
                onChange={(e) =>
                  setForm({
                    ...form,
                    add_ons: form.add_ons.map((x, j) =>
                      j === i ? { ...x, price: e.target.value } : x,
                    ),
                  })
                }
                className="w-24 rounded-xl border border-card-edge bg-ground-2 px-3 py-2 text-sm text-ink outline-none focus:border-gold"
              />
              <select
                aria-label={`Add-on ${i + 1} unit`}
                value={a.price_unit}
                onChange={(e) =>
                  setForm({
                    ...form,
                    add_ons: form.add_ons.map((x, j) =>
                      j === i ? { ...x, price_unit: e.target.value as AddOn["price_unit"] } : x,
                    ),
                  })
                }
                className="rounded-xl border border-card-edge bg-ground-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
              >
                {ADD_ON_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  setForm({ ...form, add_ons: form.add_ons.filter((_, j) => j !== i) })
                }
                className="px-1 text-sm text-ink-faint hover:text-ink"
                aria-label={`Remove add-on ${i + 1}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="md"
        className="mt-2"
        onClick={() =>
          setForm({
            ...form,
            add_ons: [...form.add_ons, { name: "", price: "", price_unit: "event" }],
          })
        }
      >
        + Add an add-on
      </Button>
    </div>
  );
}
