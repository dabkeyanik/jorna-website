// Line icons for the marketing home, drawn to the same 24px grid and 1.7 stroke
// as the tab bar's, so the two don't read as coming from different sets.

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
