"use client";

// The couple's "Propose changes" on their signing link (backend DECISIONS
// #23). The contract becomes editable copies of each section: they can
// change quantities and prices, remove a line, ask for something extra,
// adjust the payments, and edit or add clauses. A review step then shows
// their edits in the comparison view, with a message box, before sending.
//
// The working copy is the vendor editor's own model (lib/contractDraft), so
// what's sent goes through the same conversions and checks as an edit. Only
// the sections they changed are sent.

import { useMemo, useState } from "react";
import { ApiError } from "@jorna/shared/lib/api";
import { Button, Card, Field } from "@jorna/shared/components/ui";
import { ContractCompare } from "@/components/ContractCompare";
import { termsOf } from "@/lib/contractDiff";
import {
  balanceLastPayment,
  customLine,
  describeDue,
  draftTerms,
  fromContract,
  lineTotalCents,
  money,
  newKey,
  proposalChanges,
  scheduledCents,
  toCents,
  totalCents,
  type Draft,
  type InstallmentDraft,
  type LineDraft,
} from "@/lib/contractDraft";
import { fillGuestBookingDetails, proposeGuestChanges } from "@/lib/jorna";
import type { GuestBooking, ProposalHistory } from "@/lib/types";

const input =
  "w-full rounded-xl border border-card-edge bg-ground-2 px-3 py-2 text-sm text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30";

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-ink-soft">{title}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-faint">{hint}</p> : null}
      <div className="mt-3 grid gap-3">{children}</div>
    </Card>
  );
}

/** What stops this proposal being sent, in the client's words. The server
 *  checks the same things; this says so before they press Send. */
function problems(draft: Draft): string[] {
  const out: string[] = [];
  if (!draft.lines.some((l) => l.kind === "package")) out.push("Keep at least one of the vendor's packages.");
  for (const l of draft.lines) {
    if (!l.name.trim()) out.push("Give the item you're asking for a name.");
    if (!(Number(l.quantity) > 0)) out.push(`“${l.name || "An item"}” needs a quantity above zero.`);
    if (l.price.trim() === "" || toCents(l.price) < 0) out.push(`“${l.name || "An item"}” needs a price — $0 is fine.`);
  }
  if (draft.schedule.length && scheduledCents(draft) !== totalCents(draft)) {
    out.push(`The payments add up to ${money(scheduledCents(draft))} but the total is ${money(totalCents(draft))}.`);
  }
  for (const c of draft.clauses) {
    if (!c.title.trim() || !c.body.trim()) out.push("Every clause needs a title and some text.");
  }
  if (!draft.dateIso) out.push("The event needs a date.");
  return Array.from(new Set(out));
}

export function ProposeChanges({
  token,
  booking,
  onSent,
  onCancel,
}: {
  token: string;
  booking: GuestBooking;
  onSent: (history: ProposalHistory) => void;
  onCancel: () => void;
}) {
  const vendorName = booking.vendor_display_name ?? "your vendor";
  const base = useMemo(() => termsOf(booking), [booking]);
  const [draft, setDraft] = useState<Draft>(() => fromContract(booking));
  // The payments follow the total until the client edits one themselves —
  // the same arrangement as the vendor's editor.
  const [planFollows, setPlanFollows] = useState(true);
  const [step, setStep] = useState<"edit" | "review">("edit");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(booking.guest_email ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<Draft>) =>
    setDraft((d) => {
      const next = { ...d, ...patch };
      if (planFollows && "lines" in patch && next.schedule.length) next.schedule = balanceLastPayment(next);
      return next;
    });
  const setLine = (key: string, patch: Partial<LineDraft>) =>
    set({ lines: draft.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) });
  const setPayment = (key: string, patch: Partial<InstallmentDraft>) => {
    setPlanFollows(false);
    set({ schedule: draft.schedule.map((i) => (i.key === key ? { ...i, ...patch } : i)) });
  };

  const changes = useMemo(() => proposalChanges(draft, base), [draft, base]);
  const changed = Object.keys(changes).length > 0;
  const issues = problems(draft);
  const proposed = useMemo(() => draftTerms(draft), [draft]);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      if (!booking.guest_email) {
        if (!email.trim()) {
          setError("Add your email so we can tell you when they reply.");
          return;
        }
        await fillGuestBookingDetails(token, { guest_email: email.trim() });
      }
      onSent(await proposeGuestChanges(token, booking.revision ?? 1, changes, message.trim() || null));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send that. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "review") {
    return (
      <div className="grid gap-5">
        <Card className="p-5">
          <p className="text-sm font-medium text-ink-soft">Your changes</p>
          <div className="mt-3">
            <ContractCompare before={base} after={proposed} beforeLabel="Current" afterLabel="Your proposal" />
          </div>
        </Card>
        <Card className="p-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-soft">A note for {vendorName} (optional)</span>
            <textarea
              value={message}
              maxLength={2000}
              rows={3}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Why you're asking, or anything they should know"
              className={input}
            />
          </label>
          {!booking.guest_email ? (
            <div className="mt-3">
              <Field
                label="Your email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                hint="We'll email you when they reply."
                required
              />
            </div>
          ) : null}
        </Card>
        {error ? (
          <p role="alert" className="rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
            {error}
          </p>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="ghost" onClick={() => setStep("edit")} disabled={busy}>
            Back to editing
          </Button>
          <Button onClick={send} disabled={busy}>
            {busy ? "Sending…" : `Send to ${vendorName}`}
          </Button>
        </div>
        <p className="text-center text-xs text-ink-faint">
          {vendorName} can accept your changes, keep their version, or send a new one. Until then the contract
          as it is stays open to sign.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="text-center">
        <p className="eyebrow">Propose changes</p>
        <h2 className="serif mt-1 text-2xl text-maroon dark:text-gold">Suggest your version</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Change anything below. {vendorName} sees exactly what you changed, side by side with their version.
        </p>
      </div>

      <Section title="The event">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Date" type="date" value={draft.dateIso} onChange={(e) => set({ dateIso: e.target.value })} />
          <Field
            label="Last day (multi-day events)"
            type="date"
            value={draft.multiDay ? draft.dateEnd : ""}
            onChange={(e) => set({ dateEnd: e.target.value, multiDay: Boolean(e.target.value) })}
          />
          <Field label="Starts" type="time" value={draft.timeStart} onChange={(e) => set({ timeStart: e.target.value })} />
          <Field label="Ends" type="time" value={draft.timeEnd} onChange={(e) => set({ timeEnd: e.target.value })} />
        </div>
        <Field label="Venue" value={draft.location} onChange={(e) => set({ location: e.target.value })} />
        <Field
          label="Guest count"
          type="number"
          min={1}
          value={draft.guestCount}
          onChange={(e) => set({ guestCount: e.target.value })}
        />
      </Section>

      <Section title="What's included" hint="Change a quantity or price, remove a line, or ask for something extra.">
        <ul className="grid gap-3">
          {draft.lines.map((l) => (
            <li key={l.key} className="rounded-xl border border-line-soft p-3">
              <div className="flex items-start justify-between gap-2">
                {l.id ? (
                  <p className="text-sm font-medium text-ink">{l.name}</p>
                ) : (
                  <input
                    aria-label="What you're asking for"
                    placeholder="What you're asking for"
                    value={l.name}
                    onChange={(e) => setLine(l.key, { name: e.target.value })}
                    className={input}
                  />
                )}
                <button
                  type="button"
                  onClick={() => set({ lines: draft.lines.filter((x) => x.key !== l.key) })}
                  className="shrink-0 text-xs text-ink-faint underline-offset-4 hover:text-maroon hover:underline"
                  aria-label={`Remove ${l.name || "this item"}`}
                >
                  Remove
                </button>
              </div>
              <div className="mt-2 grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                <label className="text-xs text-ink-faint">
                  Quantity
                  <input
                    aria-label={`Quantity of ${l.name || "the new item"}`}
                    type="number"
                    min={1}
                    value={l.quantity}
                    onChange={(e) => setLine(l.key, { quantity: e.target.value })}
                    className={input}
                  />
                </label>
                <label className="text-xs text-ink-faint">
                  Price each ($)
                  <input
                    aria-label={`Price of ${l.name || "the new item"}`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={l.price}
                    onChange={(e) => setLine(l.key, { price: e.target.value })}
                    className={input}
                  />
                </label>
                <p className="pb-2 text-right text-sm text-ink">{money(lineTotalCents(l))}</p>
              </div>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => set({ lines: [...draft.lines, { ...customLine(), price: "0" }] })}
          className="justify-self-start text-sm font-semibold text-gold underline-offset-4 hover:underline"
        >
          + Ask for something extra
        </button>
        <p className="border-t border-line-soft pt-2 text-right text-sm text-ink-soft">
          Total <span className="font-semibold text-ink">{money(totalCents(draft))}</span>
        </p>
      </Section>

      {draft.schedule.length ? (
        <Section
          title="How you'll pay"
          hint={planFollows ? "The last payment follows the total until you change a payment yourself." : undefined}
        >
          <ul className="grid gap-3">
            {draft.schedule.map((i) => (
              <li key={i.key} className="grid grid-cols-1 gap-2 rounded-xl border border-line-soft p-3 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-ink">{i.label}</p>
                  <p className="text-xs text-ink-faint">
                    {describeDue({
                      due_type: i.dueType,
                      due_date: i.dueDate || null,
                      due_days: i.dueDays ? Number(i.dueDays) : null,
                    })}
                  </p>
                </div>
                <label className="text-xs text-ink-faint">
                  Amount ($)
                  <input
                    aria-label={`Amount for ${i.label}`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={i.amount}
                    onChange={(e) => setPayment(i.key, { amount: e.target.value })}
                    className={input}
                  />
                </label>
                {i.dueType === "before_event" ? (
                  <label className="text-xs text-ink-faint sm:col-start-2">
                    Days before the event
                    <input
                      aria-label={`Days before the event for ${i.label}`}
                      type="number"
                      min={0}
                      value={i.dueDays}
                      onChange={(e) => setPayment(i.key, { dueDays: e.target.value })}
                      className={input}
                    />
                  </label>
                ) : i.dueType === "date" ? (
                  <label className="text-xs text-ink-faint sm:col-start-2">
                    Due on
                    <input
                      aria-label={`Due date for ${i.label}`}
                      type="date"
                      value={i.dueDate}
                      onChange={(e) => setPayment(i.key, { dueDate: e.target.value })}
                      className={input}
                    />
                  </label>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="text-right text-sm text-ink-soft">
            Scheduled {money(scheduledCents(draft))} of {money(totalCents(draft))}
          </p>
        </Section>
      ) : null}

      <Section title="Terms" hint="Edit the wording, remove a clause, or add one.">
        {draft.clauses.map((c) => (
          <div key={c.key} className="grid gap-2 rounded-xl border border-line-soft p-3">
            <div className="flex items-center gap-2">
              <input
                aria-label="Clause title"
                value={c.title}
                onChange={(e) =>
                  set({ clauses: draft.clauses.map((x) => (x.key === c.key ? { ...x, title: e.target.value } : x)) })
                }
                className={input}
              />
              <button
                type="button"
                onClick={() =>
                  set({
                    clauses: draft.clauses.filter((x) => x.key !== c.key),
                    layout: draft.layout.filter((b) => b.id !== c.key),
                  })
                }
                className="shrink-0 text-xs text-ink-faint underline-offset-4 hover:text-maroon hover:underline"
                aria-label={`Remove ${c.title || "this clause"}`}
              >
                Remove
              </button>
            </div>
            <textarea
              aria-label={`Text of ${c.title || "the clause"}`}
              value={c.body}
              rows={3}
              onChange={(e) =>
                set({ clauses: draft.clauses.map((x) => (x.key === c.key ? { ...x, body: e.target.value } : x)) })
              }
              className={input}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            const key = newKey();
            const at = draft.layout.findIndex((b) => b.type === "signature");
            const layout = [...draft.layout];
            layout.splice(at < 0 ? layout.length : at, 0, { id: key, type: "terms" });
            set({ clauses: [...draft.clauses, { key, title: "", body: "" }], layout });
          }}
          className="justify-self-start text-sm font-semibold text-gold underline-offset-4 hover:underline"
        >
          + Add a clause
        </button>
        <div className="grid grid-cols-1 gap-3 border-t border-line-soft pt-3 sm:grid-cols-2">
          <Field
            label="Cancellation window (days)"
            type="number"
            min={0}
            value={draft.cancellationDays}
            onChange={(e) => set({ cancellationDays: e.target.value })}
          />
          <Field
            label="Overtime rate ($/hr)"
            type="number"
            min={0}
            value={draft.overtimeRate}
            onChange={(e) => set({ overtimeRate: e.target.value })}
          />
        </div>
      </Section>

      {issues.length && changed ? (
        <ul role="alert" className="grid gap-1 rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
          {issues.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => setStep("review")} disabled={!changed || issues.length > 0}>
          {changed ? "Review changes" : "Change something to continue"}
        </Button>
      </div>
    </div>
  );
}
