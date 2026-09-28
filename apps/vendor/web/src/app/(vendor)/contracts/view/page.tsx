"use client";

// One contract, from the vendor's side: what it says, where each payment
// stands, what happened when, and what can be done next — send or resend,
// edit, void, confirm a payment arrived.
//
// /contracts/view?id=… rather than /contracts/[id]: the site is a static
// export, so a page per contract can't be generated ahead of time.

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { confirmInstallment, getContract, sendContract, voidContract } from "@/lib/jorna";
import { describeDue, money } from "@/lib/contractDraft";
import { guestBookingLink, guestBookingPreviewLink } from "@/lib/contractLink";
import type { Contract, ContractEvent, Installment } from "@/lib/types";
import { Button, Card, LinkButton } from "@/components/ui";

function prettyDate(iso?: string | null): string {
  if (!iso || iso === "TBD") return "TBD";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft — not sent",
  sent: "Sent — not opened yet",
  viewed: "Opened — awaiting signature",
  expired: "Expired — date released",
  signed: "Signed",
  declined: "Declined",
  voided: "Voided",
};

function cents(detail: ContractEvent["detail"]): string {
  return typeof detail?.amount_cents === "number" ? ` (${money(detail.amount_cents)})` : "";
}

/** One timeline row in words. */
function describeEvent(e: ContractEvent, c: Contract): string {
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
    case "expired":
      return "The hold ended — the date opened up again";
    default:
      return e.kind;
  }
}

function installmentState(i: Installment): { text: string; tone: string } {
  if (i.confirmed_at) return { text: "Received", tone: "text-green" };
  if (i.marked_paid_at) return { text: "Client says it's sent", tone: "text-maroon dark:text-gold" };
  return { text: describeDue(i), tone: "text-ink-soft" };
}

function ContractViewInner() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const id = useSearchParams().get("id") ?? "";

  const [c, setC] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [emailOnSend, setEmailOnSend] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.replace(`/login?next=${encodeURIComponent(`/contracts/view?id=${id}`)}&role=vendor`);
  }, [authLoading, user, router, id]);

  const load = useCallback(() => getContract(id), [id]);

  useEffect(() => {
    if (!user || !id) return;
    let cancelled = false;
    load()
      .then((res) => !cancelled && setC(res))
      .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : "Couldn't load this contract."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user, id, load]);

  /** Do something, then re-read the contract so the timeline catches up. */
  async function act(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      setC(await load());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't work — try again.");
    } finally {
      setBusy(null);
    }
  }

  async function copyLink() {
    if (!c) return;
    try {
      await navigator.clipboard.writeText(guestBookingLink(c.contract_token));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard can be denied — "View as client" still opens the link */
    }
  }

  if (authLoading || !user || (loading && id)) {
    return <p className="py-20 text-center text-ink-soft">Loading…</p>;
  }
  if (!c) {
    return (
      <div className="py-20 text-center">
        <p role="alert" className="text-ink-soft">{error ?? "No contract picked."}</p>
        <LinkButton href="/contracts" variant="ghost" className="mt-4">
          All contracts
        </LinkButton>
      </div>
    );
  }

  const status = c.contract_status ?? (c.signed_at ? "signed" : "sent");
  const closed = status === "declined" || status === "voided";
  const unsigned = !c.signed_at && !closed;
  const canSend = unsigned && (status === "draft" || status === "expired" || status === "sent" || status === "viewed");
  const lines = c.line_items ?? [];

  return (
    <div className="mx-auto w-[min(760px,100%-2rem)]">
      <Link href="/contracts" className="eyebrow hover:text-gold">
        ← All contracts
      </Link>
      <header className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="serif text-3xl text-maroon dark:text-gold">
            {c.guest_name || "Client hasn't filled in details"}
          </h1>
          <p className="mt-1 text-ink-soft">
            {prettyDate(c.date_iso)}
            {c.date_end && c.date_end !== c.date_iso ? ` – ${prettyDate(c.date_end)}` : ""} · {c.time_start}–
            {c.time_end} · {c.location}
          </p>
        </div>
        <div className="text-right">
          <p className="serif text-2xl text-ink">{money(c.amount_cents)}</p>
          <p className="text-sm text-ink-soft">{STATUS_LABEL[status] ?? status}</p>
        </div>
      </header>

      {status === "sent" || status === "viewed" ? (
        c.hold_expires_at ? (
          <p className="mt-3 text-sm text-ink-faint">Your date is held for them until {prettyDate(c.hold_expires_at)}.</p>
        ) : null
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-gold">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {canSend ? (
          <>
            <Button
              disabled={busy !== null}
              onClick={() =>
                act("send", () => sendContract(c.booking_id, { emailClient: emailOnSend && Boolean(c.guest_email) }))
              }
            >
              {busy === "send"
                ? "Sending…"
                : status === "draft"
                  ? "Send & hold date"
                  : status === "expired"
                    ? "Resend & hold date"
                    : "Resend & extend hold"}
            </Button>
            {c.guest_email ? (
              <label className="flex items-center gap-1.5 text-sm text-ink-soft">
                <input type="checkbox" checked={emailOnSend} onChange={(e) => setEmailOnSend(e.target.checked)} />
                Email it to {c.guest_email}
              </label>
            ) : null}
          </>
        ) : null}
        {status !== "draft" && !closed ? (
          <>
            <Button variant="ghost" onClick={copyLink}>
              {copied ? "Copied!" : "Copy link"}
            </Button>
            <a
              href={guestBookingPreviewLink(c.contract_token)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full px-3 py-2.5 text-[0.95rem] font-semibold text-ink-soft transition hover:text-ink"
            >
              View as client
            </a>
          </>
        ) : null}
        {unsigned ? (
          <>
            <LinkButton href={`/contracts/new?edit=${c.booking_id}`} variant="ghost">
              Edit
            </LinkButton>
            <Button variant="quiet" onClick={() => setConfirmVoid(true)}>
              Void
            </Button>
          </>
        ) : null}
      </div>

      {confirmVoid ? (
        <div className="mt-3 rounded-lg bg-panel p-3">
          <p className="text-sm text-ink-soft">
            Void this contract? The link stops working and {prettyDate(c.date_iso)} opens up for other bookings.
            {c.guest_email ? " Your client will get an email saying it was withdrawn." : ""}
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="md" disabled={busy !== null} onClick={() => act("void", () => voidContract(c.booking_id)).then(() => setConfirmVoid(false))}>
              {busy === "void" ? "Voiding…" : "Void contract"}
            </Button>
            <Button variant="ghost" size="md" onClick={() => setConfirmVoid(false)}>
              Keep it
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-5">
        <Card className="p-5">
          <h2 className="serif text-lg text-ink">What&apos;s included</h2>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="border-t border-line-soft">
                  <td className="py-2 text-ink">
                    {l.name}
                    {l.quantity !== 1 ? (
                      <span className="text-ink-faint">
                        {" "}
                        × {l.quantity} at {money(l.unit_price_cents)}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 text-right text-ink">{money(l.total_cents)}</td>
                </tr>
              ))}
              {c.discount_cents ? (
                <tr className="border-t border-line-soft">
                  <td className="py-2 text-ink-soft">Discount</td>
                  <td className="py-2 text-right text-ink-soft">−{money(c.discount_cents)}</td>
                </tr>
              ) : null}
              <tr className="border-t border-line-soft font-semibold">
                <td className="py-2 text-ink">Total</td>
                <td className="py-2 text-right text-ink">{money(c.amount_cents)}</td>
              </tr>
            </tbody>
          </table>
          {c.guest_email || c.guest_phone ? (
            <p className="mt-3 text-sm text-ink-soft">{[c.guest_email, c.guest_phone].filter(Boolean).join(" · ")}</p>
          ) : null}
        </Card>

        <Card className="p-5">
          <h2 className="serif text-lg text-ink">Payments</h2>
          {c.payment_schedule?.length ? (
            <ul className="mt-3 grid gap-2">
              {c.payment_schedule.map((i) => {
                const state = installmentState(i);
                return (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-2">
                    <div>
                      <p className="text-ink">
                        {i.label} · {money(i.amount_cents)}
                      </p>
                      <p className={`text-sm ${state.tone}`}>{state.text}</p>
                    </div>
                    {c.signed_at && !i.confirmed_at ? (
                      <Button
                        size="md"
                        variant={i.marked_paid_at ? "primary" : "ghost"}
                        disabled={busy !== null}
                        onClick={() => act(`pay-${i.id}`, () => confirmInstallment(c.booking_id, i.id))}
                      >
                        {busy === `pay-${i.id}` ? "Confirming…" : "Confirm received"}
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            // A contract from before schedules: one deposit and a balance,
            // confirmed from the Bookings page as they always were.
            <div className="mt-3 text-sm text-ink-soft">
              {c.deposit_amount_cents != null ? (
                <p>
                  Deposit {money(c.deposit_amount_cents)} ({c.deposit_percent}%)
                </p>
              ) : null}
              <p>Balance: {c.payment_status === "confirmed_paid" ? "received" : "confirm on your Bookings page when it arrives"}.</p>
              {c.signed_at ? (
                <LinkButton href="/my-bookings" variant="ghost" className="mt-2">
                  Go to Bookings
                </LinkButton>
              ) : null}
            </div>
          )}
          {!c.signed_at && c.payment_schedule?.length ? (
            <p className="mt-3 text-xs text-ink-faint">Payments can be confirmed once it&apos;s signed.</p>
          ) : null}
        </Card>

        {c.terms_clauses?.length || c.cancellation_window_hours != null || c.overtime_rate_cents != null ? (
          <Card className="p-5">
            <h2 className="serif text-lg text-ink">Terms</h2>
            <div className="mt-3 grid gap-2 text-sm text-ink-soft">
              {c.cancellation_window_hours != null ? (
                <p>Cancellation window: {Math.round(c.cancellation_window_hours / 24)} days</p>
              ) : null}
              {c.overtime_rate_cents != null ? <p>Overtime: {money(c.overtime_rate_cents)}/hr</p> : null}
              {(c.terms_clauses ?? []).map((t) => (
                <p key={t.key}>
                  <strong className="text-ink">{t.title}.</strong> {t.body}
                </p>
              ))}
            </div>
          </Card>
        ) : null}

        <Card className="p-5">
          <h2 className="serif text-lg text-ink">Timeline</h2>
          <ol className="mt-3 grid gap-2">
            {(c.timeline ?? []).map((e, idx) => (
              <li key={`${e.at}-${idx}`} className="flex gap-3 text-sm">
                <span className="w-32 shrink-0 text-ink-faint">{when(e.at)}</span>
                <span className="text-ink">{describeEvent(e, c)}</span>
              </li>
            ))}
          </ol>
          {c.signed_snapshot_sha256 ? (
            <p className="mt-4 break-all text-xs text-ink-faint">
              Signed copy fingerprint (SHA-256): {c.signed_snapshot_sha256}
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}

export default function ContractViewPage() {
  return (
    <Suspense fallback={<p className="py-20 text-center text-ink-soft">Loading…</p>}>
      <ContractViewInner />
    </Suspense>
  );
}
