// Pieces every block of the contract editor (app/(vendor)/contracts/new)
// shares: the field styles, and the words for a line's unit and a block.

import type { Draft } from "@/lib/contractDraft";
import type { BlockType } from "@/lib/types";

/** A partial update to the draft. The page decides what else follows from
 *  it — the untouched payment plan tracks the total (usualSchedule). */
export type SetDraft = (patch: Partial<Draft>) => void;

// Today as YYYY-MM-DD in the vendor's own timezone — the backend allows a
// day of slack for UTC, but the form shouldn't offer yesterday at all.
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const BLOCK_LABEL: Record<BlockType, string> = {
  parties: "Parties",
  event: "Event details",
  items: "Packages & items",
  schedule: "Payment schedule",
  terms: "Terms section",
  signature: "Signatures",
};

export const UNIT_WORD: Record<string, string> = {
  event: "each",
  person: "per guest",
  hour: "per hour",
  day: "per day",
  item: "each",
};

export const inputClass =
  "w-full rounded-lg border border-card-edge bg-ground-2 px-3 py-2 text-sm text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30";
export const smallButton =
  "rounded-full border border-card-edge px-3 py-1 text-xs font-semibold text-ink-soft transition hover:border-gold hover:text-ink";
