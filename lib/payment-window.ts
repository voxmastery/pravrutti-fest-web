/**
 * How the college's payment portal is opened.
 *
 * We cannot see inside the portal — a different origin, and the gateway
 * behind it sends X-Frame-Options: DENY — so the only thing we can observe is
 * the window we opened for it: whether it is still open, and bringing it to
 * the front.
 *
 * On a PC that window is a popup sitting on top of this page. The student
 * pays in it and closes it, and the closing is our cue to ask how it went.
 * Phones turn every window.open into a tab whatever features we ask for, and
 * there the cue is the student switching back to us — so we ask for nothing
 * special and let the tab be a tab.
 */
export type PortalKind = "popup" | "tab";

export type PortalOpening = { kind: PortalKind; target: string; features: string };

/** Named, so opening it again finds the same window instead of spawning another. */
export const PORTAL_WINDOW_NAME = "pravrutti-payment";

const POPUP_MAX_WIDTH = 880;
const POPUP_MAX_HEIGHT = 860;
/* Room left around the popup so the page beneath stays recognisable. */
const SCREEN_MARGIN_X = 80;
const SCREEN_MARGIN_Y = 60;
/* Below this a popup would cover the page entirely — no better than a tab. */
const MIN_POPUP_SCREEN_WIDTH = 900;

export function portalOpening(env: {
  pointerFine: boolean;
  availWidth: number;
  availHeight: number;
}): PortalOpening {
  if (!env.pointerFine || env.availWidth < MIN_POPUP_SCREEN_WIDTH) {
    return { kind: "tab", target: "_blank", features: "" };
  }
  const width = Math.min(POPUP_MAX_WIDTH, env.availWidth - SCREEN_MARGIN_X);
  const height = Math.min(POPUP_MAX_HEIGHT, env.availHeight - SCREEN_MARGIN_Y);
  const left = Math.round((env.availWidth - width) / 2);
  const top = Math.round((env.availHeight - height) / 2);
  return {
    kind: "popup",
    target: PORTAL_WINDOW_NAME,
    features: `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`,
  };
}

type Opener<W> = (url: string, target: string, features: string) => W | null;

/**
 * Opens the portal and hands back the window.
 *
 * Deliberately not `noopener`: that returns null, and with it goes the one
 * signal we have (`closed`). Disowning the opener afterwards gives the same
 * protection — the portal cannot navigate this page — while we keep the
 * handle. Must be called inside the click that asked for it, or the browser
 * treats the window as a pop-under and blocks it; null means it did.
 */
export function openPortal<W extends { opener: unknown }>(
  url: string,
  opening: PortalOpening,
  open: Opener<W> = (u, t, f) => window.open(u, t, f) as unknown as W | null,
): W | null {
  const w = open(url, opening.target, opening.features);
  if (w) {
    try {
      w.opener = null;
    } catch {
      /* A browser that refuses still gave us the handle, which is the part we need. */
    }
  }
  return w;
}
