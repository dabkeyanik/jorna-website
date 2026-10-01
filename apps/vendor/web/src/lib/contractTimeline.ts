// A contract's timeline in words — shared by the contract page and the Leads
// drawer, so the two can't describe the same event differently.

import { money } from "@/lib/contractDraft";
import type { ContractEvent } from "@/lib/types";

export function prettyDate(iso?: string | null): string {
  if (!iso || iso === "TBD") return "TBD";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function cents(detail: ContractEvent["detail"]): string {
  return typeof detail?.amount_cents === "number" ? ` (${money(detail.amount_cents)})` : "";
}

/** One timeline row in words. */
export function describeEvent(e: ContractEvent, c: { signer_name?: string | null }): string {
  const d = e.detail ?? {};
  switch (e.kind) {
    case "created":
      return d.draft ? "Created as a draft" : "Created";
    case "sent":
    case "resent":
      return `${e.kind === "sent" ? "Sent" : "Resent"}${
        typeof d.hold_expires_at === "string" ? ` — date held until ${prettyDate(d.hold_expires_at)}` : ""
      }`;
    case "emailed":
      return `Link emailed to ${typeof d.to === "string" ? d.to : "your client"}`;
    case "viewed":
      return "Your client opened it";
    case "edited":
      return `You edited it${typeof d.revision === "number" ? ` (version ${d.revision})` : ""}`;
    case "signed":
      return `Signed by ${typeof d.signer_name === "string" ? d.signer_name : c.signer_name ?? "your client"}`;
    case "declined":
      return `Your client declined${typeof d.reason === "string" && d.reason ? ` — “${d.reason}”` : ""}`;
    case "voided":
      return "You voided it";
    case "payment_marked":
      return `Your client says ${typeof d.label === "string" ? d.label : "a payment"}${cents(d)} is sent`;
    case "payment_confirmed":
      return `You confirmed ${typeof d.label === "string" ? d.label : "a payment"}${cents(d)} arrived`;
    case "payment_reminder": {
      // Sent by the backend's payment reminder sweep: the client before and
      // on the due date, this vendor once it's overdue.
      const what = `${typeof d.label === "string" ? d.label : "a payment"}${cents(d)}`;
      const due = typeof d.due_on === "string" ? prettyDate(d.due_on) : "its due date";
      return d.reminder === "overdue"
        ? `Overdue: ${what} was due ${due} — we let you know`
        : d.reminder === "due"
          ? `Reminded your client ${what} is due today`
          : `Reminded your client ${what} is due ${due}`;
    }
        case "expired":
      return "The hold ended — the date opened up again";
    default:
      return e.kind;
  }
}
