"use client";

import type { Draft } from "@jorna/shared/lib/contractDraft";
import { inputClass, type SetDraft } from "./shared";

/**
 * Cancellation window and overtime rate, edited where they print: under the
 * payment schedule, as the client's copy shows them (ContractPaper's
 * "Cancellation and overtime"). They used to be a "Policies" card in the
 * side rail, away from the document they're part of.
 *
 * How long sending holds the date isn't a contract term, so it stays with
 * Send in the rail.
 */
export function PoliciesBlock({ draft, set }: { draft: Draft; set: SetDraft }) {
  return (
    <div className="mt-6 border-t border-dashed border-line-soft pt-4">
      <p className="text-sm font-semibold text-ink">Cancellation and overtime</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs text-ink-faint">Cancellation window (days)</span>
          <input
            type="number"
            min={0}
            placeholder="e.g. 30"
            value={draft.cancellationDays}
            onChange={(e) => set({ cancellationDays: e.target.value })}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-ink-faint">Overtime rate ($/hr)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={draft.overtimeRate}
            onChange={(e) => set({ overtimeRate: e.target.value })}
            className={inputClass}
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        {draft.cancellationDays
          ? `Cancelling within ${draft.cancellationDays} days of the event may forfeit what's been paid.`
          : "Leave it blank for no cancellation window."}
        {draft.overtimeRate ? ` Extra time is billed at $${draft.overtimeRate} an hour.` : ""}
      </p>
    </div>
  );
}
