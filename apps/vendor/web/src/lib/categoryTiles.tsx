// The eight category tiles shown on Home and as filter chips in the Marketplace.
// Carries iOS's canonical (category, subcategory) pairs verbatim — see
// CategoryView.Category.canonical — because several tiles are subcategories
// rather than categories ("DJ" is music_entertainment/dj), and a DJ tile must
// never list dhol players. Shared by both pages so the pairs can't drift apart.

export interface Tile {
  label: string;
  category: string;
  subcategory?: string;
  art: React.ReactNode;
}

const icon = (d: React.ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-7"
    aria-hidden="true"
  >
    {d}
  </svg>
);

export const TILES: Tile[] = [
  { label: "Venue", category: "venue", art: icon(<path d="M3 21h18M5 21V8l7-4 7 4v13M10 21v-6h4v6" />) },
  { label: "Catering", category: "catering", art: icon(<path d="M4 17h16a8 8 0 0 0-16 0ZM12 5.5V8M3 20.5h18" />) },
  {
    label: "Decor",
    category: "floral_decor",
    art: icon(<path d="M12 3l1.5 4.2L18 9l-4.5 1.8L12 15l-1.5-4.2L6 9l4.5-1.8L12 3ZM18 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" />),
  },
  {
    label: "Photographer",
    category: "photography",
    art: icon(<path d="M4 8h3l1.5-2h7L17 8h3v11H4V8Zm8 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />),
  },
  {
    label: "DJ",
    category: "music_entertainment",
    subcategory: "dj",
    art: icon(<path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM17.5 6.5 14 10" />),
  },
  {
    label: "Mehndi",
    category: "beauty",
    subcategory: "mehndi_artist",
    art: icon(<path d="M8 21v-4.5L6.2 14a1.4 1.4 0 0 1 2.2-1.7L10 14V4.5a1.4 1.4 0 0 1 2.8 0V11M12.8 11V6.2a1.4 1.4 0 0 1 2.8 0V12M15.6 12v-1.3a1.4 1.4 0 0 1 2.8 0V16a5 5 0 0 1-5 5H8" />),
  },
  {
    label: "Dhol",
    category: "music_entertainment",
    subcategory: "dhol",
    art: icon(<path d="M4 8c0-1.7 3.6-3 8-3s8 1.3 8 3v8c0 1.7-3.6 3-8 3s-8-1.3-8-3V8Zm0 0c0 1.7 3.6 3 8 3s8-1.3 8-3M7 12.5l10 3M17 12.5l-10 3" />),
  },
  {
    label: "Other",
    category: "other",
    art: icon(<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM7.5 12h.01M12 12h.01M16.5 12h.01" />),
  },
];

/** The Marketplace URL for a tile — category (and subcategory, when the tile is one). */
export function tileHref(tile: Tile): string {
  const params = new URLSearchParams({ category: tile.category });
  if (tile.subcategory) params.set("subcategory", tile.subcategory);
  return `/marketplace?${params.toString()}`;
}
