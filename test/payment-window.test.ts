import { describe, it, expect, vi } from "vitest";
import { portalOpening, openPortal, PORTAL_WINDOW_NAME } from "@/lib/payment-window";

const desktop = { pointerFine: true, availWidth: 1536, availHeight: 824 };
const phone = { pointerFine: false, availWidth: 390, availHeight: 844 };

describe("portalOpening", () => {
  /* A popup is the whole point on a PC: the portal sits on top of our page
     and closing it is the signal we can actually observe. */
  it("opens a centred popup on a desktop-sized screen with a fine pointer", () => {
    const o = portalOpening(desktop);
    expect(o.kind).toBe("popup");
    expect(o.target).toBe(PORTAL_WINDOW_NAME);
    expect(o.features).toContain("popup=yes");
    expect(o.features).toMatch(/width=880/);
    expect(o.features).toMatch(/height=764/); // 824 - 60
    expect(o.features).toMatch(/left=328/); // (1536 - 880) / 2
    expect(o.features).toMatch(/top=30/); // (824 - 764) / 2
  });

  it("never asks for a window wider or taller than the screen allows", () => {
    const o = portalOpening({ pointerFine: true, availWidth: 1000, availHeight: 700 });
    expect(o.features).toMatch(/width=880/);
    expect(o.features).toMatch(/height=640/);
  });

  /* Phones turn every window.open into a tab whatever we ask for, and a
     touch laptop below 900px would get a popup that covers everything. */
  it("falls back to a plain new tab on touch or narrow screens", () => {
    expect(portalOpening(phone)).toEqual({ kind: "tab", target: "_blank", features: "" });
    expect(portalOpening({ ...desktop, availWidth: 800 }).kind).toBe("tab");
    expect(portalOpening({ ...desktop, pointerFine: false }).kind).toBe("tab");
  });
});

describe("openPortal", () => {
  it("passes the opening through and disowns the opener while keeping the handle", () => {
    const handle = { opener: {} as unknown, closed: false };
    const open = vi.fn(() => handle);
    const o = portalOpening(desktop);
    const w = openPortal("https://portal.example/pay", o, open);
    expect(open).toHaveBeenCalledWith("https://portal.example/pay", PORTAL_WINDOW_NAME, o.features);
    expect(w).toBe(handle);
    /* Without this the portal gets `window.opener` and could navigate our
       page; with noopener we would get no handle and no closed signal. */
    expect(handle.opener).toBeNull();
  });

  it("returns null when the browser blocked the window", () => {
    const open = vi.fn(() => null);
    expect(openPortal("https://portal.example/pay", portalOpening(phone), open)).toBeNull();
  });
});
