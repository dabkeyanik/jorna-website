"use client";

// "I'm at the venue", with the browser's location attached.
//
// The backend verifies the coordinates against the venue, so a check-in is a
// geolocation prompt before it's an API call — and the interesting part is what
// to say when the browser refuses. Lives here because both the vendor's
// bookings list and the vendor dashboard offer the action, and two copies of a
// permission flow drift.

import { checkInBooking } from "./jorna";

/** Thrown for the location half, so callers can tell it from an API failure. */
export class LocationError extends Error {}

function here(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(
        new LocationError(
          "This browser can't share a location, so it can't verify you're at the venue.",
        ),
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      () =>
        reject(
          new LocationError(
            "Couldn't read your location. You need to allow it to check in at the venue.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  });
}

/** Check in at the venue for one booking. Rejects with LocationError or ApiError. */
export async function checkInAtVenue(bookingId: string): Promise<void> {
  const pos = await here();
  await checkInBooking(bookingId, pos.coords.latitude, pos.coords.longitude);
}
