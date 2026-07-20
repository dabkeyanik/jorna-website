"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { createReview, getBookingReview } from "@/lib/jorna";
import type { Review } from "@/lib/types";
import { Button } from "./ui";

function Stars({
  value,
  onChange,
  readonly,
}: {
  value: number;
  onChange?: (n: number) => void;
  readonly?: boolean;
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          className={`text-xl leading-none ${n <= value ? "text-gold" : "text-ink-faint"} ${
            readonly ? "" : "hover:text-gold"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

/**
 * Leave (or show) a review for a booking. Loads any existing review — one per
 * booking — and otherwise offers the form. Client-only; the parent decides when
 * to render it (a paid/completed booking).
 */
export function ReviewPanel({ bookingId }: { bookingId: string }) {
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getBookingReview(bookingId)
      .then((r) => !cancelled && setReview(r))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const created = await createReview(bookingId, rating, comment.trim() || undefined);
      setReview(created);
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't submit your review.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  if (review) {
    return (
      <div className="mt-3 border-t border-line-soft pt-3">
        <div className="flex items-center gap-2">
          <Stars value={Math.round(review.rating)} readonly />
          <span className="text-xs text-ink-faint">Your review</span>
        </div>
        {review.comment ? (
          <p className="mt-1 text-sm text-ink-soft">{review.comment}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-line-soft pt-3">
      {open ? (
        <div>
          <p className="mb-2 text-xs text-ink-soft">How was it?</p>
          <Stars value={rating} onChange={setRating} />
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="Anything you'd tell the next host? (optional)"
            className="mt-2 w-full rounded-lg border border-card-edge bg-ground-2 px-3 py-2 text-sm text-ink outline-none focus:border-gold"
          />
          {error ? (
            <p className="mt-1 text-xs text-maroon dark:text-gold">{error}</p>
          ) : null}
          <div className="mt-2 flex gap-2">
            <Button size="md" disabled={busy} onClick={submit}>
              {busy ? "Submitting…" : "Submit review"}
            </Button>
            <Button variant="ghost" size="md" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm font-semibold text-gold hover:underline"
        >
          Leave a review
        </button>
      )}
    </div>
  );
}
