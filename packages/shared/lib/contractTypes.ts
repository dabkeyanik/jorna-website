// The contract's own shapes: line items, payments, clauses, the editor's
// layout, and change proposals (backend 0065, 0067, 0068). Both apps use them,
// and so does the negotiation code in this package (lib/contractDraft,
// contractDiff, negotiation; components/negotiation). Each app's lib/types
// re-exports them, so imports from "@/lib/types" keep working.

/** Free-form contract terms (equipment/power, travel, custom clauses) —
 *  narrative, never computed against, so one flexible shape rather than a
 *  column per clause. See Booking.contract_terms in the backend. */
export interface ContractTerms {
  equipment_power?: string;
  travel?: string;
  custom?: { label: string; value: string }[];
}

// ── What a contract says (backend 0065, its DECISIONS.md #16) ─────────

export type LineItemKind = "package" | "addon" | "custom";
export type LineUnit = "event" | "person" | "hour" | "day" | "item";

/** A snapshot — names and prices as quoted, not joined back to the package. */
export interface LineItem {
  id: string;
  kind: LineItemKind;
  service_id: string | null;
  addon_id: string | null;
  name: string;
  description: string | null;
  unit: LineUnit;
  unit_price_cents: number;
  quantity: number;
  total_cents: number;
}

export type DueType = "on_signing" | "date" | "before_event";

export interface Installment {
  id: string;
  label: string;
  amount_cents: number;
  due_type: DueType;
  due_date: string | null;
  due_days: number | null;
  /** The calendar date it's due — null for "on signing" until signed. */
  due_on: string | null;
  marked_paid_at: string | null;
  confirmed_at: string | null;
}

export interface Clause {
  key: string;
  title: string;
  body: string;
}

/** One block of the contract editor's document. A terms block's text lives
 *  in terms_clauses under the same key; the rest are drawn from the
 *  contract's own fields. Each structured type appears at most once. */
export type BlockType = "parties" | "event" | "items" | "schedule" | "signature" | "terms";

export interface LayoutBlock {
  id: string;
  type: BlockType;
}

/** What the editor sends: a terms block carries its title and body. */
export interface LayoutBlockInput extends LayoutBlock {
  title?: string;
  body?: string;
}

export interface ContractEvent {
  at: string;
  kind: string;
  actor: "vendor" | "client" | "system";
  detail: Record<string, unknown> | null;
}

/** What's sent for a line; the server fills ids and totals. */
export interface LineItemInput {
  id?: string;
  kind: LineItemKind;
  service_id?: string | null;
  addon_id?: string | null;
  name?: string;
  description?: string | null;
  unit?: LineUnit;
  unit_price_cents: number;
  quantity: number;
}

export interface InstallmentInput {
  id?: string;
  label: string;
  amount_cents: number;
  due_type: DueType;
  due_date?: string | null;
  due_days?: number | null;
}

export interface ContractCreateInput {
  /** The one-package form; the builder sends line_items instead. */
  service_id?: string;
  date_iso: string;
  date_end?: string | null;
  time_start: string;
  time_end: string;
  amount_cents?: number;
  line_items?: LineItemInput[];
  discount_cents?: number | null;
  payment_schedule?: InstallmentInput[];
  terms_clauses?: Clause[];
  document_title?: string | null;
  document_layout?: LayoutBlockInput[];
  guest_count?: number | null;
  draft?: boolean;
  hold_days?: number | null;
  email_client?: boolean;
  deposit_percent?: number | null;
  cancellation_window_hours?: number | null;
  overtime_rate_cents?: number | null;
  addon_rate_cents?: number | null;
  contract_terms?: ContractTerms | null;
  /** Optional up front — the client can still correct them before signing. */
  guest_name?: string | null;
  guest_email?: string | null;
  guest_phone?: string | null;
  location?: string | null;
}

// ── Change proposals (backend 0068, its DECISIONS.md #23) ────────────

export type ProposalStatus = "open" | "accepted" | "declined" | "revised" | "superseded" | "withdrawn";

/** A payment as agreed: no payment marks. */
export interface InstallmentTerms {
  id: string;
  label: string;
  amount_cents: number;
  due_type: DueType;
  due_date: string | null;
  due_days: number | null;
}

/** One version of a contract's terms — a revision, or a client's proposal.
 *  What a change proposal can change, and what the comparison compares. */
export interface TermsVersion {
  date_iso: string;
  date_end: string | null;
  time_start: string;
  time_end: string;
  location: string;
  guest_count: number | null;
  line_items: LineItem[] | null;
  discount_cents: number | null;
  amount_cents: number;
  payment_schedule: InstallmentTerms[] | null;
  terms_clauses: Clause[] | null;
  cancellation_window_hours: number | null;
  overtime_rate_cents: number | null;
}

export interface ChangeProposal {
  proposal_id: string;
  base_revision: number;
  status: ProposalStatus;
  message: string | null;
  response_note: string | null;
  /** The revision an Accept or Revise produced. */
  result_revision: number | null;
  created_at: string;
  responded_at: string | null;
  proposed: TermsVersion;
}

export interface ContractRevisionRow {
  revision: number;
  created_at: string;
  terms: TermsVersion;
}

/** GET …/proposals, on either side. Newest first. */
/** One side's unsaved work in the negotiation workspace (backend 0069,
 *  DECISIONS #24). `changes` holds the whole working version's terms. */
export interface NegotiationDraft {
  base_revision: number;
  changes: Partial<TermsVersion>;
  message: string | null;
  /** The open proposal a vendor's draft answers. */
  proposal_id: string | null;
  updated_at: string;
  /** The contract moved past base_revision since it was saved. */
  stale: boolean;
}

export interface ProposalHistory {
  current_revision: number | null;
  open_proposal: ChangeProposal | null;
  proposals: ChangeProposal[];
  revisions: ContractRevisionRow[];
  /** The caller's own saved draft (absent on an older backend). */
  draft?: NegotiationDraft | null;
}

/** What a client sends: any terms, minus the derived total. */
export type TermsChanges = Partial<Omit<TermsVersion, "amount_cents" | "line_items" | "payment_schedule">> & {
  line_items?: LineItemInput[];
  payment_schedule?: InstallmentInput[];
};
