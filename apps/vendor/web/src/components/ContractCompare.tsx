"use client";

// Two versions of a contract side by side: what the client proposed against
// what's on the table, or a vendor's new version against the last one
// (backend DECISIONS #23). Used on the couple's signing page and on the
// vendor's /contracts/changes, from lib/contractDiff's one reading of what
// changed.
//
// Wide screens get "Current | Proposed" columns. On a phone each change
// stacks: the old value struck through, the new one highlighted. Sections
// with no changes fold behind "Show unchanged".

import { useMemo, useState } from "react";
import {
  diffTerms,
  type ClauseChange,
  type DiffSection,
  type FieldChange,
  type LineChange,
  type PaymentChange,
  type WordPiece,
} from "@/lib/contractDiff";
import { describeDue, money } from "@/lib/contractDraft";
import type { InstallmentTerms, LineItem, TermsVersion } from "@/lib/types";

const SECTIONS: { id: DiffSection; title: string }[] = [
  { id: "event", title: "Event details" },
  { id: "items", title: "Line items" },
  { id: "schedule", title: "Payment schedule" },
  { id: "terms", title: "Terms" },
  { id: "policies", title: "Policies" },
];

const KIND_LABEL = { added: "Added", removed: "Removed", changed: "Changed" } as const;

function Old({ children }: { children: React.ReactNode }) {
  return (
    <del className="rounded bg-maroon/[0.07] px-1 text-maroon decoration-maroon/60 dark:bg-gold/10 dark:text-gold">
      {children}
    </del>
  );
}

function New({ children }: { children: React.ReactNode }) {
  return <ins className="rounded bg-green/15 px-1 text-ink no-underline">{children}</ins>;
}

function Empty() {
  return <span className="text-ink-faint">—</span>;
}

/** One change: a label, then the two values — columns when there's room. */
function Row({ label, tag, before, after }: { label: string; tag?: string; before: React.ReactNode; after: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-line-soft py-2.5 text-sm md:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_minmax(0,1fr)] md:gap-4">
      <p className="font-medium text-ink">
        {label}
        {tag ? <span className="ml-2 text-[0.7rem] font-bold uppercase tracking-wide text-ink-faint">{tag}</span> : null}
      </p>
      <div className="min-w-0">{before}</div>
      <div className="min-w-0">{after}</div>
    </div>
  );
}

function lineText(l: LineItem): string {
  return l.quantity === 1
    ? money(l.total_cents)
    : `${l.quantity} × ${money(l.unit_price_cents)} = ${money(l.total_cents)}`;
}

function paymentText(p: InstallmentTerms): string {
  return `${money(p.amount_cents)} · ${describeDue(p)}`;
}

function FieldRows({ changes }: { changes: FieldChange[] }) {
  return (
    <>
      {changes.map((c) => (
        <Row key={c.label} label={c.label} before={<Old>{c.before}</Old>} after={<New>{c.after}</New>} />
      ))}
    </>
  );
}

function LineRows({ changes }: { changes: LineChange[] }) {
  return (
    <>
      {changes.map((c) => (
        <Row
          key={`${c.kind}:${c.before?.id ?? c.after?.id}`}
          label={c.name}
          tag={KIND_LABEL[c.kind]}
          before={c.before ? <Old>{lineText(c.before)}</Old> : <Empty />}
          after={
            c.after ? (
              <>
                <New>{lineText(c.after)}</New>
                {c.notes.length ? <p className="mt-1 text-xs text-ink-faint">{c.notes.join(" · ")}</p> : null}
              </>
            ) : (
              <Empty />
            )
          }
        />
      ))}
    </>
  );
}

function PaymentRows({ changes }: { changes: PaymentChange[] }) {
  return (
    <>
      {changes.map((c) => (
        <Row
          key={`${c.kind}:${c.before?.id ?? c.after?.id}`}
          label={c.label}
          tag={KIND_LABEL[c.kind]}
          before={c.before ? <Old>{paymentText(c.before)}</Old> : <Empty />}
          after={c.after ? <New>{paymentText(c.after)}</New> : <Empty />}
        />
      ))}
    </>
  );
}

function Words({ pieces, show }: { pieces: WordPiece[]; show: "before" | "after" | "both" }) {
  return (
    <p className="whitespace-pre-wrap leading-relaxed text-ink-soft">
      {pieces.map((w, i) =>
        w.op === "same" ? (
          <span key={i}>{w.text}</span>
        ) : w.op === "del" ? (
          show === "after" ? null : <Old key={i}>{w.text}</Old>
        ) : show === "before" ? null : (
          <New key={i}>{w.text}</New>
        ),
      )}
    </p>
  );
}

function ClauseRows({ changes }: { changes: ClauseChange[] }) {
  return (
    <>
      {changes.map((c) => {
        const key = `${c.kind}:${c.before?.key ?? c.after?.key}`;
        if (c.kind !== "changed") {
          return (
            <Row
              key={key}
              label={c.title}
              tag={KIND_LABEL[c.kind]}
              before={c.before ? <Old>{c.before.body}</Old> : <Empty />}
              after={c.after ? <New>{c.after.body}</New> : <Empty />}
            />
          );
        }
        const retitled = c.before && c.after && c.before.title !== c.after.title;
        return (
          <div key={key} className="border-t border-line-soft py-2.5 text-sm">
            <p className="font-medium text-ink">
              {retitled ? (
                <>
                  <Old>{c.before!.title}</Old> <New>{c.after!.title}</New>
                </>
              ) : (
                c.title
              )}
              <span className="ml-2 text-[0.7rem] font-bold uppercase tracking-wide text-ink-faint">Changed</span>
            </p>
            {c.words ? (
              <>
                {/* Phone: one text, edits inline. */}
                <div className="mt-1 md:hidden">
                  <Words pieces={c.words} show="both" />
                </div>
                <div className="mt-1 hidden gap-4 md:grid md:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_minmax(0,1fr)]">
                  <span />
                  <Words pieces={c.words} show="before" />
                  <Words pieces={c.words} show="after" />
                </div>
              </>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

/** A section with nothing changed, shown when asked for — the version as it
 *  stands, once. */
function Unchanged({ section, terms }: { section: DiffSection; terms: TermsVersion }) {
  const rows: [string, string][] = [];
  if (section === "event") {
    rows.push(["Date", terms.date_end && terms.date_end !== terms.date_iso ? `${terms.date_iso} – ${terms.date_end}` : terms.date_iso]);
    rows.push(["Time", `${terms.time_start} – ${terms.time_end}`]);
    rows.push(["Venue", terms.location || "TBD"]);
    if (terms.guest_count) rows.push(["Guests", String(terms.guest_count)]);
  } else if (section === "items") {
    for (const l of terms.line_items ?? []) rows.push([l.name, lineText(l)]);
    rows.push(["Total", money(terms.amount_cents)]);
  } else if (section === "schedule") {
    for (const p of terms.payment_schedule ?? []) rows.push([p.label, paymentText(p)]);
  } else if (section === "terms") {
    for (const c of terms.terms_clauses ?? []) rows.push([c.title, c.body]);
  } else {
    if (terms.cancellation_window_hours != null) {
      rows.push(["Cancellation window", `${Math.round(terms.cancellation_window_hours / 24)} days`]);
    }
    if (terms.overtime_rate_cents != null) rows.push(["Overtime rate", `${money(terms.overtime_rate_cents)}/hr`]);
  }
  if (!rows.length) return <p className="border-t border-line-soft py-2.5 text-sm text-ink-faint">Nothing here.</p>;
  return (
    <dl className="text-sm">
      {rows.map(([k, v], i) => (
        <div key={i} className="grid gap-1 border-t border-line-soft py-2 md:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] md:gap-4">
          <dt className="text-ink-faint">{k}</dt>
          <dd className="whitespace-pre-wrap text-ink-soft">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ContractCompare({
  before,
  after,
  beforeLabel = "Current",
  afterLabel = "Proposed",
}: {
  before: TermsVersion;
  after: TermsVersion;
  beforeLabel?: string;
  afterLabel?: string;
}) {
  const diff = useMemo(() => diffTerms(before, after), [before, after]);
  const [showUnchanged, setShowUnchanged] = useState(false);
  const unchanged = SECTIONS.filter((s) => diff.counts[s.id] === 0);

  return (
    <div aria-label="Comparison" role="region">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-ink-soft">
          {diff.count === 0
            ? "No differences between the two versions."
            : `${diff.count} change${diff.count === 1 ? "" : "s"}`}
          {diff.total ? (
            <>
              {" · Total "}
              <Old>{diff.total.before}</Old> <New>{diff.total.after}</New>
            </>
          ) : null}
        </p>
        {unchanged.length ? (
          <button
            type="button"
            onClick={() => setShowUnchanged((v) => !v)}
            className="text-xs font-semibold text-gold underline-offset-4 hover:underline"
          >
            {showUnchanged ? "Hide unchanged" : `Show unchanged (${unchanged.length})`}
          </button>
        ) : null}
      </div>

      <div className="mt-3 hidden gap-4 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-ink-faint md:grid md:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_minmax(0,1fr)]">
        <span />
        <span>{beforeLabel}</span>
        <span>{afterLabel}</span>
      </div>

      {SECTIONS.map(({ id, title }) => {
        const n = diff.counts[id];
        if (n === 0 && !showUnchanged) return null;
        return (
          <section key={id} aria-label={title} className="mt-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
              {title}
              <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[0.7rem] font-bold text-ink-soft">
                {n === 0 ? "No changes" : `${n} change${n === 1 ? "" : "s"}`}
              </span>
            </h3>
            {n === 0 ? (
              <Unchanged section={id} terms={after} />
            ) : id === "event" ? (
              <FieldRows changes={diff.event} />
            ) : id === "items" ? (
              <>
                <LineRows changes={diff.items} />
                {diff.discount ? <FieldRows changes={[diff.discount]} /> : null}
              </>
            ) : id === "schedule" ? (
              <PaymentRows changes={diff.schedule} />
            ) : id === "terms" ? (
              <ClauseRows changes={diff.terms} />
            ) : (
              <FieldRows changes={diff.policies} />
            )}
          </section>
        );
      })}
    </div>
  );
}
