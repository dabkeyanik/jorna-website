"use client";

// The vendor's calendar: a month of their bookings, and what's coming next.
//
// It takes the slot "Hours" used to hold in the seller nav. Weekly hours still
// exist and still matter — they're what a host filtering by a date is matched
// against — so this links through to them rather than dropping them; the
// summary here says at a glance whether any are set.
//
// A booking spanning several days appears on each of them (see bookingsByDay),
// because a three-day marquee hire is three days of work, not one.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { getMyAvailability, getMyVendor, listVendorBookings } from "@/lib/jorna";
import {
  calendarMonth,
  vendorJobs,
  type CalendarDay,
  type VendorJob,
} from "@/lib/vendorPlan";
import {
  WEEKDAYS,
  type AvailabilitySlot,
  type VendorBooking,
} from "@/lib/types";
import { Button, Card, LinkButton } from "@/components/ui";
import { VendorNav } from "@/components/VendorNav";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function clock(raw?: string | null): string | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const d = new Date(2000, 0, 1, Number(m[1]), Number(m[2]));
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function prettyDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
}

function DayCell({
  day,
  selected,
  onSelect,
}: {
  day: CalendarDay;
  selected: boolean;
  onSelect: (iso: string) => void;
}) {
  const has = day.bookings.length > 0;
  return (
    <button
      type="button"
      onClick={() => onSelect(day.dateIso)}
      aria-current={day.isToday ? "date" : undefined}
      aria-label={`${day.dateIso}${has ? `, ${day.bookings.length} booked` : ""}`}
      className={`flex aspect-square flex-col items-center justify-start gap-1 rounded-lg p-1.5 transition sm:p-2 ${
        selected
          ? "bg-maroon text-ground dark:bg-gold dark:text-[#2A0C19]"
          : day.isToday
            ? "bg-gold/15 text-ink"
            : has
              ? "bg-panel text-ink hover:bg-gold/10"
              : "text-ink-faint hover:bg-panel"
      } ${day.inMonth ? "" : "opacity-35"} ${day.isPast && !selected ? "opacity-60" : ""}`}
    >
      <span
        className={`text-xs tabular-nums sm:text-sm ${
          day.isToday && !selected ? "font-bold" : ""
        }`}
      >
        {day.day}
      </span>
      {has ? (
        <span className="flex flex-wrap justify-center gap-0.5">
          {day.bookings.slice(0, 3).map((b, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={`size-1.5 rounded-full ${
                selected ? "bg-ground dark:bg-[#2A0C19]" : "bg-gold"
              }`}
            />
          ))}
        </span>
      ) : null}
    </button>
  );
}

export default function VendorCalendarPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [bookings, setBookings] = useState<VendorBooking[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [notVendor, setNotVendor] = useState(false);
  const [loading, setLoading] = useState(true);

  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/my-calendar");
  }, [authLoading, user, router]);

  const fetchAll = useCallback(async () => {
    if (!user) return null;
    const me = await getMyVendor().catch(() => null);
    if (!me) return { vendor: null as null };
    const [bk, avail] = await Promise.all([
      listVendorBookings(me.vendor_id, { limit: 200 })
        .then((r) => r.items)
        .catch(() => [] as VendorBooking[]),
      getMyAvailability().catch(() => [] as AvailabilitySlot[]),
    ]);
    return { vendor: me, bookings: bk, availability: avail };
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    fetchAll().then((snap) => {
      if (cancelled || !snap) return;
      if (!snap.vendor) {
        setNotVendor(true);
        setLoading(false);
        return;
      }
      setBookings(snap.bookings ?? []);
      setAvailability(snap.availability ?? []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchAll]);

  const days = useMemo(
    () => calendarMonth(bookings, year, month),
    [bookings, year, month],
  );
  const upcoming = useMemo(() => vendorJobs(bookings), [bookings]);
  const selectedDay = selected ? days.find((d) => d.dateIso === selected) : undefined;

  function step(by: number) {
    const d = new Date(year, month + by, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setSelected(null);
  }

  if (authLoading || !user || loading) {
    return <p className="py-20 text-center text-ink-soft">Loading…</p>;
  }

  if (notVendor) {
    return (
      <div className="mx-auto w-[min(560px,100%-2rem)] py-20 text-center">
        <h1 className="serif text-3xl text-maroon dark:text-gold">Vendor calendar</h1>
        <p className="mx-auto mt-3 max-w-[44ch] text-ink-soft">
          You don&apos;t have a vendor profile yet.
        </p>
        <LinkButton href="/vendor-profile" className="mt-6">
          Start selling
        </LinkButton>
      </div>
    );
  }

  const bookedThisMonth = days.filter((d) => d.inMonth && d.bookings.length > 0).length;

  return (
    <div className="mx-auto w-[min(880px,100%-2rem)] py-10">
      <header>
        <span className="eyebrow">Vendor</span>
        <h1 className="serif mt-1 text-4xl text-maroon dark:text-gold">Calendar</h1>
      </header>

      <div className="mt-6">
        <VendorNav />
      </div>

      {/* ── The month ── */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="md" onClick={() => step(-1)}>
            ←
          </Button>
          <div className="text-center">
            <h2 className="serif text-xl text-ink">
              {MONTHS[month]} {year}
            </h2>
            <p className="text-xs text-ink-faint">
              {bookedThisMonth === 0
                ? "Nothing booked this month"
                : `${bookedThisMonth} ${bookedThisMonth === 1 ? "day" : "days"} booked`}
            </p>
          </div>
          <Button variant="ghost" size="md" onClick={() => step(1)}>
            →
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d) => (
            <p
              key={d}
              className="pb-1 text-center text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-ink-faint"
            >
              {d.slice(0, 3)}
            </p>
          ))}
          {days.map((d) => (
            <DayCell
              key={d.dateIso}
              day={d}
              selected={selected === d.dateIso}
              onSelect={(iso) => setSelected(iso === selected ? null : iso)}
            />
          ))}
        </div>

        {selectedDay ? (
          <div className="mt-4 border-t border-line-soft pt-4">
            <p className="text-sm font-semibold text-ink">
              {prettyDate(selectedDay.dateIso)}
            </p>
            {selectedDay.bookings.length === 0 ? (
              <p className="mt-1 text-sm text-ink-soft">Nothing booked.</p>
            ) : (
              <ul className="mt-2 grid gap-2">
                {selectedDay.bookings.map((b) => (
                  <li
                    key={b.booking_id}
                    className="rounded-xl bg-panel px-3 py-2.5 text-sm"
                  >
                    <p className="font-medium text-ink">
                      {b.service_name || "Service"}
                      {b.client_name ? (
                        <span className="font-normal text-ink-soft">
                          {" "}
                          · {b.client_name}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-ink-faint">
                      {[
                        clock(b.time_start)
                          ? `${clock(b.time_start)}${
                              clock(b.time_end) ? ` – ${clock(b.time_end)}` : ""
                            }`
                          : null,
                        b.location,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "No time set"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </Card>

      {/* ── What's coming ── */}
      <section className="mt-8">
        <h2 className="eyebrow mb-3">Upcoming</h2>
        {upcoming.length === 0 ? (
          <p className="rounded-2xl border border-card-edge bg-panel p-5 text-center text-ink-soft">
            Nothing booked yet.
          </p>
        ) : (
          <div className="grid gap-2">
            {upcoming.slice(0, 8).map((job: VendorJob) => (
              <div
                key={job.booking.booking_id}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-card-edge bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {job.booking.service_name || "Service"}
                    {job.booking.client_name ? (
                      <span className="font-normal text-ink-soft">
                        {" "}
                        · {job.booking.client_name}
                      </span>
                    ) : null}
                  </p>
                  {job.booking.location ? (
                    <p className="text-xs text-ink-faint">{job.booking.location}</p>
                  ) : null}
                </div>
                <p className="shrink-0 text-sm text-ink-soft">
                  {job.isToday ? (
                    <span className="font-semibold text-maroon dark:text-gold">Today</span>
                  ) : (
                    prettyDate(job.dateIso)
                  )}
                  {clock(job.booking.time_start) ? (
                    <span className="text-ink-faint">
                      {" "}
                      · {clock(job.booking.time_start)}
                    </span>
                  ) : null}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Weekly hours ──
          Not shown in the nav any more, but still the thing a host filtering by
          a date is matched against, so it keeps a way in from here. */}
      <section className="mt-8">
        <h2 className="eyebrow mb-3">Weekly hours</h2>
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-ink-soft">
            {availability.length === 0
              ? "You haven't set any. Hosts filtering by a date can't tell whether you're free."
              : `Set on ${new Set(availability.map((s) => s.day_of_week)).size} of 7 days.`}
          </p>
          <LinkButton href="/my-availability" variant="ghost" size="md">
            {availability.length === 0 ? "Set your hours" : "Edit hours"}
          </LinkButton>
        </Card>
      </section>

      <p className="mt-8 text-center text-sm text-ink-faint">
        <Link href="/my-bookings" className="text-gold hover:underline">
          All your bookings
        </Link>
      </p>
    </div>
  );
}
