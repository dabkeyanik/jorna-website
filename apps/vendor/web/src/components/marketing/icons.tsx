// Line icons for the marketing home, drawn to the same 24px grid and 1.7 stroke
// as the tab bar's, so the two don't read as coming from different sets.

import type { ReactNode } from "react";

const stroke = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const IconCalendar = (
  <svg {...stroke} className="size-5">
    <path d="M4 6.5h16v14H4v-14ZM4 10h16M8 3v4M16 3v4" />
  </svg>
);

export const IconUsers = (
  <svg {...stroke} className="size-5">
    <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20a6.5 6.5 0 0 1 13 0M16 11.5a3 3 0 0 0 0-6M18 20a6 6 0 0 0-3-5.2" />
  </svg>
);

export const IconShield = (
  <svg {...stroke} className="size-5">
    <path d="M12 3l7 3v6c0 4.4-3 8-7 9-4-1-7-4.6-7-9V6l7-3Zm-2.5 8.8 2 2 4-4.3" />
  </svg>
);

export const IconLock = (
  <svg {...stroke} className="size-5">
    <path d="M6.5 10.5h11v9h-11v-9ZM8.75 10.5V7.75a3.25 3.25 0 0 1 6.5 0v2.75M12 14v2.2" />
  </svg>
);

export const IconCheck = (
  <svg {...stroke} className="size-3.5" strokeWidth={2.4}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </svg>
);

export const IconArrow = (
  <svg {...stroke} className="size-4">
    <path d="M4 12h15m-5.5-5.5L19 12l-5.5 5.5" />
  </svg>
);

// ── Celebrations ─────────────────────────────────────────────────────────
// The "Plan by celebration" tiles used emoji, which drag in whatever the
// visitor's OS decides they look like — eight different illustration styles at
// eight different weights, and colours the page never chose. These are drawn to
// the same grid as the icons above and take their colour from the tile, so the
// row reads as one set.
//
// Keyed by the celebration keys in lib/celebrations. A tile added there without
// a drawing here falls back to IconCelebration rather than going blank, so the
// two files don't have to be edited together.

const IconRing = (
  <svg {...stroke} className="size-6">
    <circle cx="12" cy="15.9" r="4.3" />
    <path d="M8.9 7.6h6.2L12 11.1 8.9 7.6Z" />
    <path d="M8.9 7.6 11 5.2h2l2.1 2.4" />
  </svg>
);

const IconNotes = (
  <svg {...stroke} className="size-6">
    <path d="M9.5 17.2V6.4l8.2-1.9v10.7" />
    <circle cx="7.6" cy="17.4" r="1.9" />
    <circle cx="15.8" cy="15.3" r="1.9" />
  </svg>
);

// A lotus — one of the motifs henna is actually drawn in, and the one that
// survives 24px. A paisley was the obvious first choice and doesn't: at this
// size its inner curl closes up and the whole thing reads as a letter B.
const IconLotus = (
  <svg {...stroke} className="size-6">
    <path d="M12 5.6c1.7 2 2.5 3.6 2.5 5.3s-.8 3.1-2.5 4.1c-1.7-1-2.5-2.4-2.5-4.1s.8-3.3 2.5-5.3Z" />
    <path d="M9.7 14.9c-2.3.5-4.2 0-5.6-1.6-1.4-1.6-1.8-3.5-1.2-5.7 2.3.3 4 1.2 5.2 2.7" />
    <path d="M14.3 14.9c2.3.5 4.2 0 5.6-1.6 1.4-1.6 1.8-3.5 1.2-5.7-2.3.3-4 1.2-5.2 2.7" />
    <path d="M4.2 15.6c1.4 2.8 4 4.2 7.8 4.2s6.4-1.4 7.8-4.2" />
  </svg>
);

const IconDiya = (
  <svg {...stroke} className="size-6">
    <path d="M12 5c1.8 2.1 2.7 3.5 2.7 4.7a2.7 2.7 0 0 1-5.4 0C9.3 8.5 10.2 7.1 12 5Z" />
    <path d="M12 12.4v2.4" />
    <path d="M4.4 14.8h15.2c0 2.8-3.4 4.7-7.6 4.7s-7.6-1.9-7.6-4.7Z" />
  </svg>
);

// Two flutes meeting at the rim. Each is drawn upright on the centre line, then
// tilted about its own foot and slid outwards, which is what puts the rims
// together without redrawing the glass twice.
const flute = (
  <>
    <path d="M9.7 4.4h4.6l-1.4 5.4c-.15.6-.5.9-.9.9s-.75-.3-.9-.9L9.7 4.4Z" />
    <path d="M12 10.9v8.7M9.9 19.6h4.2" />
  </>
);

const IconFlutes = (
  <svg {...stroke} className="size-6">
    <g transform="translate(-6 0) rotate(14 12 19.6)">{flute}</g>
    <g transform="translate(6 0) rotate(-14 12 19.6)">{flute}</g>
  </svg>
);

const IconSparkles = (
  <svg {...stroke} className="size-6">
    <path d="M11 4.2c.7 3.9 2 5.2 5.9 5.9-3.9.7-5.2 2-5.9 5.9-.7-3.9-2-5.2-5.9-5.9 3.9-.7 5.2-2 5.9-5.9Z" />
    <path d="M18.4 15.1c.3 1.7.8 2.2 2.4 2.5-1.6.3-2.1.8-2.4 2.5-.3-1.7-.8-2.2-2.4-2.5 1.6-.3 2.1-.8 2.4-2.5Z" />
  </svg>
);

const IconCake = (
  <svg {...stroke} className="size-6">
    <path d="M12 3.4c1 1.1 1 2.1 0 3-1-.9-1-1.9 0-3Z" />
    <path d="M12 6.6v3.8" />
    <path d="M5.2 19.6v-8c0-.6.5-1.1 1.1-1.1h11.4c.6 0 1.1.5 1.1 1.1v8" />
    <path d="M5.2 14.4h13.6M3.4 19.6h17.2" />
  </svg>
);

const IconMortarboard = (
  <svg {...stroke} className="size-6">
    <path d="m12 4.6 9.2 4.1-9.2 4.1-9.2-4.1 9.2-4.1Z" />
    <path d="M7.2 10.9v4.6c0 1.5 2.2 2.7 4.8 2.7s4.8-1.2 4.8-2.7v-4.6" />
    <path d="M19.6 9.6v4.2" />
  </svg>
);

/** For a celebration key with no drawing of its own. */
export const IconCelebration = (
  <svg {...stroke} className="size-6">
    <path d="m12 4 1.9 6.1L20 12l-6.1 1.9L12 20l-1.9-6.1L4 12l6.1-1.9L12 4Z" />
  </svg>
);

export const CELEBRATION_ICONS: Record<string, ReactNode> = {
  wedding: IconRing,
  sangeet: IconNotes,
  mehndi: IconLotus,
  pooja: IconDiya,
  bachelor: IconFlutes,
  bachelorette: IconSparkles,
  birthday: IconCake,
  graduation: IconMortarboard,
};
