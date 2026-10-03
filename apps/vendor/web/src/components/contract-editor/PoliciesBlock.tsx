"use client";

import { Field } from "@jorna/shared/components/ui";
import type { Draft } from "@/lib/contractDraft";
import type { SetDraft } from "./shared";

/** Cancellation window, overtime rate and how long sending holds the date.
 *  Still a card in the rail; the first two print in the contract, so they
 *  move into the document next (plan 2.3b). */
export function PoliciesBlock({
  draft,
  set,
  showHold,
  defaultHoldDays,
}: {
  draft: Draft;
  set: SetDraft;
  /** Hold days only matter when sending; an edit keeps the hold it has. */
  showHold: boolean;
  defaultHoldDays: number;
}) {
  return (
    <div className="grid gap-3 rounded-2xl border border-card-edge bg-card p-5 shadow-[var(--shadow-card)]">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-ink-faint">Policies</p>
      <Field
        label="Cancellation window (days)"
        type="number"
        min={0}
        placeholder="e.g. 30"
        value={draft.cancellationDays}
        onChange={(e) => set({ cancellationDays: e.target.value })}
      />
      <Field
        label="Overtime rate ($/hr)"
        type="number"
        min={0}
        step="0.01"
        value={draft.overtimeRate}
        onChange={(e) => set({ overtimeRate: e.target.value })}
      />
      {showHold ? (
        <Field
          label="Hold the date for (days)"
          type="number"
          min={1}
          max={60}
          placeholder={String(defaultHoldDays)}
          value={draft.holdDays}
          onChange={(e) => set({ holdDays: e.target.value })}
          hint="If they haven't signed by then, the date opens up again."
        />
      ) : null}
    </div>
  );
}
