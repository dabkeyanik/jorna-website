"use client";

import { centsMoney, describePayment, type PaymentRow } from "@/lib/contract";
import type { Installment } from "@/lib/types";
import { Button } from "@/components/ui";

const TONE: Record<PaymentRow["state"], string> = {
  received: "text-green",
  sent: "text-ink-faint",
  overdue: "text-maroon dark:text-gold",
  due: "text-gold",
  upcoming: "text-ink-faint",
};

/**
 * A signed contract's payments, one row each, with its own "I sent this".
 *
 * One button for the whole booking marked every payment sent at once — fine
 * for a single payment, wrong the moment a contract has a deposit and a
 * balance three months apart. Each payment is marked on its own, in any
 * order: people do pay early.
 */
export function PaymentSchedule({
  rows,
  vendorName,
  busyId,
  onMark,
}: {
  rows: PaymentRow[];
  vendorName: string;
  /** The installment being marked right now, if any. */
  busyId?: string | null;
  /** Omitted where the list is read-only. */
  onMark?: (installment: Installment) => void;
}) {
  return (
    <ul className="grid gap-2">
      {rows.map((row) => {
        const { installment } = row;
        const open = row.state !== "received" && row.state !== "sent";
        return (
          <li
            key={installment.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-ground-2 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-sm text-ink">
                {installment.label} · <span className="font-medium tabular-nums">{centsMoney(installment.amount_cents)}</span>
              </p>
              <p className={`text-xs ${TONE[row.state]}`}>{describePayment(row, vendorName)}</p>
            </div>
            {onMark && open ? (
              <Button
                size="md"
                variant={row.state === "upcoming" ? "ghost" : "primary"}
                disabled={Boolean(busyId)}
                onClick={() => onMark(installment)}
              >
                {busyId === installment.id ? "Marking…" : "I sent this"}
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
