import { LinkButton, Rule } from "@/components/ui";
import { categoryLabel, CATEGORY_LABELS } from "@/lib/types";

const HOT = new Set(["venue", "dj", "dhol", "mehndi"]);

export default function Home() {
  return (
    <div className="mx-auto w-[min(1080px,100%-2rem)]">
      <section className="bg-[radial-gradient(120%_90%_at_50%_-10%,rgba(169,121,31,0.2),transparent_60%)] py-16 text-center sm:py-24">
        <span className="eyebrow">The South Asian celebration marketplace</span>
        <h1 className="serif mt-4 text-6xl text-maroon dark:text-gold sm:text-7xl">Jorna</h1>
        <p className="mx-auto mt-5 max-w-[38ch] text-lg text-ink sm:text-xl">
          Your whole celebration in one place — a matched team of vendors, booked and
          paid for safely, from the first idea to the last dance.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <LinkButton href="/plan" size="lg">
            Try it now — build a bundle
          </LinkButton>
          <LinkButton href="/login" variant="ghost" size="lg">
            Sign in
          </LinkButton>
        </div>
        <p className="mt-5 text-sm text-ink-faint">
          Answer a few questions and get three ready-to-book vendor teams.
        </p>
      </section>

      <div className="py-6">
        <Rule />
      </div>

      <section className="pb-14 text-center">
        <p className="mx-auto max-w-[60ch] text-ink-soft">
          Planning a wedding or big event means juggling a dozen vendors across calls,
          texts, and spreadsheets. Jorna brings it into one place: tell it about your
          event and it assembles complete vendor teams for you. Every payment is held
          safely until the event actually happens.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          {Object.keys(CATEGORY_LABELS).map((key) => (
            <span
              key={key}
              className={`rounded-full border px-3 py-1 text-sm ${
                HOT.has(key)
                  ? "border-gold/50 text-maroon dark:text-gold"
                  : "border-card-edge text-ink-soft"
              } bg-ground-2`}
            >
              {categoryLabel(key)}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
