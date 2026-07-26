// Trending celebrations — the iOS home's trending tiles (Wedding, Sangeet,
// Mehndi, Birthday, Graduation). Picking one opens the bundle builder with the
// categories that celebration usually needs already ticked.
//
// Two things to know about this mapping:
//
// 1. It only *preselects*. Nothing is locked — every category stays togglable,
//    and the builder still refuses to run with none selected.
// 2. The celebration itself is not sent anywhere. Neither BundleRequest nor the
//    server's ChatbotState declares an event-type field, and undeclared keys are
//    dropped on the first round trip, so inventing one would silently do
//    nothing. It shapes the starting form and the copy, that's all.
//
// The values are bundle slot keys from CATEGORY_LABELS. Lists are deliberately
// short: the builder has to fill every selected slot from real local supply, so
// six plausible slots beat ten aspirational ones that return no bundle.

export interface Celebration {
  key: string;
  label: string;
  /** What it usually takes — the starting selection in the builder. */
  categories: string[];
}

export const CELEBRATIONS: Celebration[] = [
  {
    key: "wedding",
    label: "Wedding",
    categories: ["venue", "catering", "photography", "dj", "floral_decor", "makeup"],
  },
  {
    key: "sangeet",
    label: "Sangeet",
    categories: ["venue", "catering", "dj", "dhol", "floral_decor"],
  },
  {
    key: "mehndi",
    label: "Mehndi",
    categories: ["venue", "catering", "mehndi", "photography", "floral_decor"],
  },
  {
    key: "birthday",
    label: "Birthday",
    categories: ["venue", "catering", "dj", "photography"],
  },
  {
    key: "graduation",
    label: "Graduation",
    categories: ["venue", "catering", "photography", "dj"],
  },
];

export function celebrationByKey(key: string | null | undefined): Celebration | undefined {
  return key ? CELEBRATIONS.find((c) => c.key === key) : undefined;
}
