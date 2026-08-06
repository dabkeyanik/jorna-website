"use client";

// How far along a celebration is, drawn as one bar.
//
// It replaces a bar of the same shape that was made of money — see the Progress
// section of lib/planning for why that couldn't be made to mean this. The
// counts come from there, so this file decides only how they look and what they
// are called.

import {
  PROGRESS_STAGES,
  type ProgressBreakdown,
  type ProgressStage,
} from "@/lib/planning";

/**
 * Most-advanced first, so the bar fills from the left and what hasn't been
 * started is the gap left at the end — the same reading as the money bar this
 * replaced, and the same direction as the vendor list underneath it.
 */
const DRAW_ORDER = [...PROGRESS_STAGES].reverse();

/** Green for finished, gold deepening as money moves, maroon for stuck. */
const FILL: Record<ProgressStage, string> = {
  done: "bg-green",
  problem: "bg-maroon",
  paid: "bg-gold",
  accepted: "bg-gold/50",
  awaiting: "bg-gold/25",
  chosen: "bg-ink-faint/25",
  // Nothing: the track shows through, and the gap is the whole point.
  toBook: "bg-transparent",
};

/** The legend's dot, which is the fill except where the fill is nothing. */
const DOT: Record<ProgressStage, string> = {
  ...FILL,
  toBook: "border border-ink-faint/50",
};

const LABEL: Record<ProgressStage, string> = {
  done: "done",
  problem: "in dispute",
  paid: "paid",
  accepted: "accepted, to pay",
  awaiting: "waiting on a reply",
  chosen: "in your draft",
  toBook: "still to book",
};

/**
 * The bar, with a legend that says the same thing in words.
 *
 * The bar itself is hidden from screen readers rather than given a
 * progressbar role: it has seven states, not a value, and the legend below is
 * the honest version of it — which is also why the legend isn't optional.
 */
export function PlanProgress({
  progress,
  className = "",
}: {
  progress: ProgressBreakdown;
  className?: string;
}) {
  const { stages, total } = progress;
  if (total === 0) return null;

  const shown = DRAW_ORDER.filter((stage) => stages[stage] > 0);

  return (
    <div className={className}>
      <div
        aria-hidden="true"
        className="flex h-2 overflow-hidden rounded-full bg-line-soft"
      >
        {shown.map((stage) => (
          <div
            key={stage}
            className={FILL[stage]}
            // Counts over the same total, so the widths always sum to exactly
            // 100% — there is no scale to choose and nothing to clamp.
            style={{ width: `${(stages[stage] / total) * 100}%` }}
          />
        ))}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-ink-soft">
        {shown.map((stage) => (
          <span key={stage} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`size-1.5 shrink-0 rounded-full ${DOT[stage]}`}
            />
            {stages[stage]} {LABEL[stage]}
          </span>
        ))}
      </p>
    </div>
  );
}
