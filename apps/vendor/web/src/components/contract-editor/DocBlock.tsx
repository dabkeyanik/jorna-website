"use client";

import type { ReactNode } from "react";
import type { LayoutBlock } from "@/lib/types";
import { BLOCK_LABEL } from "./shared";

/** One block of the document, with its label and the controls that move it. */
export function DocBlock({
  block,
  index,
  count,
  issue,
  onMove,
  onAddBelow,
  onRemove,
  children,
}: {
  block: LayoutBlock;
  index: number;
  count: number;
  issue: boolean;
  onMove: (delta: -1 | 1) => void;
  onAddBelow: () => void;
  onRemove?: () => void;
  children: ReactNode;
}) {
  const label = BLOCK_LABEL[block.type];
  return (
    <section
      id={`block-${block.id}`}
      aria-label={label}
      className={`group relative scroll-mt-24 border-t border-line-soft py-6 first:border-t-0 ${issue ? "rounded-lg ring-1 ring-maroon/30 dark:ring-gold/40" : ""}`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-ink-faint">{label}</p>
        <span className="flex items-center gap-1 opacity-100 transition sm:opacity-40 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          <button
            type="button"
            aria-label={`Move ${label.toLowerCase()} up`}
            disabled={index === 0}
            onClick={() => onMove(-1)}
            className="rounded px-1.5 py-0.5 text-xs text-ink-faint hover:text-ink disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            aria-label={`Move ${label.toLowerCase()} down`}
            disabled={index === count - 1}
            onClick={() => onMove(1)}
            className="rounded px-1.5 py-0.5 text-xs text-ink-faint hover:text-ink disabled:opacity-30"
          >
            ↓
          </button>
          <button type="button" onClick={onAddBelow} className="rounded px-1.5 py-0.5 text-xs text-ink-faint hover:text-ink">
            + Section below
          </button>
          {onRemove ? (
            <button type="button" onClick={onRemove} className="rounded px-1.5 py-0.5 text-xs text-ink-faint hover:text-maroon">
              Remove
            </button>
          ) : null}
        </span>
      </div>
      {children}
    </section>
  );
}
