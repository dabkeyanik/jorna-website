"use client";

// The app's first manual light/dark toggle. globals.css already fully
// implements both palettes behind a `data-theme="light"|"dark"` attribute
// (falling back to `prefers-color-scheme` when unset) — nothing here needs a
// CSS change, only a place to flip that attribute and remember the choice.

const KEY = "jorna_theme";

export type Theme = "light" | "dark";

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
  );
}

/** The explicit choice, if any — null means "follow the system". */
export function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(KEY);
  return v === "light" || v === "dark" ? v : null;
}

/** What's actually showing right now, explicit choice or system fallback. */
export function getEffectiveTheme(): Theme {
  return getStoredTheme() ?? (systemPrefersDark() ? "dark" : "light");
}

export function setTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, theme);
  document.documentElement.dataset.theme = theme;
}

export function toggleTheme(): Theme {
  const next: Theme = getEffectiveTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}
