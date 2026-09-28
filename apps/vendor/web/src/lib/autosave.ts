// Debounced saving that doesn't lose or reorder what you typed.
//
// Pulled out of the component that needed it because the hard parts aren't
// React: a pause is not the same as a keystroke, two saves in flight can land
// in either order, and a form left mid-pause still has something owed to it.
// All three are the same failure to a person — the thing they typed isn't
// there — and none of them are visible in a screenshot.
//
// The unit of work is a snapshot: a string that stands for everything the form
// currently holds. The caller reports it on every render and this decides
// whether anything is owed. Comparing strings rather than diffing fields keeps
// the rule blunt on purpose — "is this what the server has" is the only
// question worth asking here.

export type SaveStatus = "idle" | "saving" | "saved";

export interface SaverOptions {
  /** How long a pause counts as "done typing". */
  delayMs: number;
  onStatus?: (status: SaveStatus) => void;
  onError?: (error: unknown) => void;
  /** Run after a save lands — to refresh whatever reads the saved value. */
  after?: () => void | Promise<void>;
}

export interface Saver {
  /**
   * Report what's on screen. Safe to call on every render.
   *
   * The first call is the baseline: opening a form is not an edit, and a save
   * on mount would write the server's own answers back to it.
   */
  submit(snapshot: string, write: () => Promise<void>): void;
  /**
   * Write anything outstanding now, reporting status as usual. For the retry a
   * failure offers, where waiting out a pause that already elapsed would look
   * like the button did nothing.
   */
  saveNow(): void;
  /**
   * Write anything outstanding immediately, without debouncing and without
   * reporting status. For unmount, where there's nobody left to tell.
   */
  flush(): void;
  /** Drop a pending save. Nothing outstanding is written. */
  cancel(): void;
  /** True when something on screen hasn't reached the server yet. */
  isDirty(): boolean;
}

export function createSaver({ delayMs, onStatus, onError, after }: SaverOptions): Saver {
  /** The snapshot the server has. Null until the baseline arrives. */
  let written: string | null = null;
  /** The last snapshot handed in, so an unchanged render doesn't re-arm the timer. */
  let seen: string | null = null;
  let pending: { snapshot: string; write: () => Promise<void> } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  let again = false;

  function stopTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  async function run(): Promise<void> {
    if (!pending || pending.snapshot === written) return;
    if (inFlight) {
      // Queued rather than run alongside. Two writes of the same form landing
      // out of order would put the older answers on top of the newer ones.
      again = true;
      return;
    }

    const { snapshot, write } = pending;
    inFlight = true;
    onStatus?.("saving");
    try {
      await write();
      written = snapshot;
      onStatus?.("saved");
      await after?.();
    } catch (error) {
      onStatus?.("idle");
      onError?.(error);
    } finally {
      inFlight = false;
      if (again) {
        again = false;
        // Reads `pending` afresh, so the follow-up writes what's on screen now
        // rather than what was waiting when it was queued.
        void run();
      }
    }
  }

  return {
    submit(snapshot, write) {
      pending = { snapshot, write };

      if (written === null) {
        written = snapshot;
        seen = snapshot;
        return;
      }
      // Nothing new since the last render — including the re-render a save's
      // own status change causes, which would otherwise re-arm the timer for
      // as long as the save took.
      if (snapshot === seen) return;
      seen = snapshot;

      // Typed back to what the server already has. Nothing is owed, so a timer
      // already running should stop rather than write an identical answer.
      if (snapshot === written) {
        stopTimer();
        return;
      }

      stopTimer();
      timer = setTimeout(() => {
        timer = null;
        void run();
      }, delayMs);
    },

    saveNow() {
      stopTimer();
      void run();
    },

    flush() {
      stopTimer();
      if (pending && pending.snapshot !== written) void pending.write();
    },

    cancel() {
      stopTimer();
    },

    isDirty() {
      return pending !== null && written !== null && pending.snapshot !== written;
    },
  };
}
