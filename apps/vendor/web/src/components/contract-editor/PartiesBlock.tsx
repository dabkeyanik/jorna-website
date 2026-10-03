"use client";

import type { Draft } from "@/lib/contractDraft";
import type { VendorBooking } from "@/lib/types";
import { inputClass, type SetDraft } from "./shared";

/** Who the agreement is between. A request's client comes from their
 *  account; anyone else is typed in, and can correct it on the link. */
export function PartiesBlock({
  vendorName,
  vendorCategory,
  draft,
  set,
  request,
}: {
  vendorName: string;
  vendorCategory: string | null;
  draft: Draft;
  set: SetDraft;
  request: VendorBooking | null;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div>
        <p className="text-xs text-ink-faint">Provider</p>
        <p className="serif mt-1 text-lg text-ink">{vendorName}</p>
        {vendorCategory ? <p className="text-sm text-ink-soft">{vendorCategory}</p> : null}
      </div>
      <div>
        <p className="text-xs text-ink-faint">Client</p>
        {request ? (
          <>
            <p className="serif mt-1 text-lg text-ink">{request.client_name || "Your client"}</p>
            <p className="text-xs text-ink-faint">From their Jorna account.</p>
          </>
        ) : (
          <div className="mt-1 grid gap-2">
            <input
              aria-label="Client name"
              placeholder="Who this booking is for"
              value={draft.clientName}
              onChange={(e) => set({ clientName: e.target.value })}
              className={inputClass}
            />
            <input
              aria-label="Client email"
              type="email"
              placeholder="Email (optional — we can send the link)"
              value={draft.clientEmail}
              onChange={(e) => set({ clientEmail: e.target.value })}
              className={inputClass}
            />
            <input
              aria-label="Client phone"
              type="tel"
              placeholder="Phone (optional)"
              value={draft.clientPhone}
              onChange={(e) => set({ clientPhone: e.target.value })}
              className={inputClass}
            />
            <p className="text-xs text-ink-faint">They can fill in or correct these on the link.</p>
          </div>
        )}
      </div>
    </div>
  );
}
