// Shared by every marketing page (Home, How it works, For clients, For
// vendors) — was defined once per page before the 2026-09 split; one copy
// now that there are four of them.
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow mb-3">{children}</p>;
}
