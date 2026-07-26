// Links out of the app and back to the marketing site.
//
// The app is served under basePath "/app", and next/link prefixes that onto
// every href — so <Link href="/"> lands on the app's own home, not the
// marketing page. Escaping the basePath needs plain anchors.
//
// These point at /welcome/ rather than "/", because the root now redirects into
// the app: linking to "/" would send anyone trying to leave straight back in.
//
// Terms, Privacy and Support are here deliberately. App Store guideline 1.2
// requires an app carrying user content — chat, reviews, uploaded photos — to
// make its terms and a way to reach a human reachable from inside the app, not
// only from a website someone has to go looking for.

const LINKS = [
  { href: "/welcome/", label: "About Jorna" },
  { href: "/terms/", label: "Terms" },
  { href: "/privacy/", label: "Privacy" },
  { href: "/support/", label: "Support" },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line-soft py-8">
      <div className="mx-auto flex w-[min(1080px,100%-2rem)] flex-wrap items-center justify-between gap-x-5 gap-y-3 text-sm">
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-ink-soft transition hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <p className="text-ink-faint">
          <span className="text-gold">✦</span> Jorna — the South Asian celebration
          marketplace
        </p>
      </div>
    </footer>
  );
}
