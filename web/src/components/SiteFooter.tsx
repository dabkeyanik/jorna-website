// Links out of the app and back to the marketing site.
//
// The app is served under basePath "/app", and next/link prefixes that onto
// every href — so <Link href="/"> lands on the app's own home, not the
// marketing page. Escaping the basePath needs a plain anchor.
//
// It points at /help/ rather than "/", because the root now redirects into
// the app: linking to "/" would send anyone trying to leave straight back in.
//
// Terms / Privacy / Support belong here too — App Store guideline 1.2 wants an
// app carrying user content to make them reachable from inside the app. The
// pages are drafted but not published (drafts/), so linking to them now would
// only produce 404s; add the links back when they go live.

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line-soft py-8">
      <div className="mx-auto flex w-[min(1080px,100%-2rem)] flex-wrap items-center justify-between gap-3 text-sm">
        <a href="/help/" className="text-ink-soft transition hover:text-ink">
          ← About Jorna
        </a>
        <p className="text-ink-faint">
          <span className="text-gold">✦</span> Jorna — the South Asian celebration
          marketplace
        </p>
      </div>
    </footer>
  );
}
