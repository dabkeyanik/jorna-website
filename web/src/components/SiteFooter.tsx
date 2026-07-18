// Links out of the app and back to the marketing site.
//
// The app is served under basePath "/app", and next/link prefixes that onto
// every href — so <Link href="/"> lands on the app's own home, not the
// marketing page. Escaping the basePath needs a plain anchor.

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line-soft py-8">
      <div className="mx-auto flex w-[min(1080px,100%-2rem)] flex-wrap items-center justify-between gap-3 text-sm">
        <a href="/" className="text-ink-soft transition hover:text-ink">
          ← Back to jornaevents.com
        </a>
        <p className="text-ink-faint">
          <span className="text-gold">✦</span> Jorna — the South Asian celebration
          marketplace
        </p>
      </div>
    </footer>
  );
}
