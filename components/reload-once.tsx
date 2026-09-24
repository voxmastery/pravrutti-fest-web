"use client";

import { useEffect } from "react";

const KEY = "pravrutti:error-reload";
/* Long enough that a page which fails again straight after the reload is
   shown the error instead of looping; short enough that a later, unrelated
   deploy still gets its one reload. */
const WINDOW_MS = 30_000;

/**
 * Reload the page once when an error boundary catches something.
 *
 * Every deploy renames every JS chunk. A phone holding a page from before the
 * deploy (a tab left open, or a copy an edge was still serving) asks for a
 * chunk that is gone, the navigation throws, and Next shows its bare "This
 * page couldn't load". A reload fetches the current HTML, which points at
 * chunks that exist, so the reader never sees the error. The sessionStorage
 * stamp keeps it to one attempt, so a genuine bug still reaches the fallback.
 */
export function useReloadOnce(): boolean {
  let willReload = false;
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    willReload = typeof window !== "undefined" && Date.now() - last > WINDOW_MS;
  } catch {
    /* Storage blocked: fall through to the fallback UI rather than risk a loop. */
  }

  useEffect(() => {
    if (!willReload) return;
    try {
      sessionStorage.setItem(KEY, String(Date.now()));
    } catch {
      return;
    }
    window.location.reload();
  }, [willReload]);

  return willReload;
}
