import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { discoverizeState, mayPay } from "@/lib/discoverize";
import { JUNO_PAYMENT_URL } from "@/lib/juno";

/* A shortlisted Discoverize lead clicked Pay ₹200 and landed on the fest
   site instead of the college's payment page.

   The shortlist is a server-only view. The row in storage still says
   payment "not_required" and has no round, so any screen that decides from
   that raw row treats the team as a free entry: Pay never opens, and the
   My tickets link (?finish=pay) arrives on the event page with nothing to
   do. The event page has to be handed the server view, and the ticket
   control has to be a real link into that hand-off — the same JUNO URL
   every other paid event opens. */

const store = new Map<string, any>();
const identity = vi.hoisted(() => ({ email: "nayanasree1906@gmail.com" as string | null }));

vi.mock("@/lib/blob-store", () => ({
  applicationPath: (e: string, m: string) => `app/${e}/${m}.json`,
  teamPath: (e: string, c: string) => `team/${e}/${c}.json`,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
}));
vi.mock("@/lib/identity", () => ({ resolveEmail: async () => identity.email }));
vi.mock("@/lib/roles", () => ({
  resolveRole: async () => ({ kind: "none" }),
  canViewEvent: () => false,
}));

let resolveEventAccess: typeof import("@/lib/event-access").resolveEventAccess;
beforeAll(async () => {
  ({ resolveEventAccess } = await import("@/lib/event-access"));
});

const EV = "discoverize-research-paper-presentation";
const LISTED = "nayanasree1906@gmail.com";
const KEY = `app/${EV}/${LISTED}.json`;

const rawRow = () => ({
  ticketId: "PRV-L",
  eventId: EV,
  eventName: "Discoverize (Research Paper Presentation)",
  status: "pending" as const,
  payment: "not_required" as const,
  fee: "Free",
  name: "Nayanasree",
  email: LISTED,
  phone: "9876543210",
  college: "RUAS",
  teamName: null,
  teamCode: null,
  paymentRef: null,
  appliedAt: "2026-10-01T09:00:00.000Z",
});

beforeEach(() => {
  store.clear();
  identity.email = LISTED;
  store.set(KEY, rawRow());
});

const read = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

describe("the server view a shortlisted payer must be shown", () => {
  it("reads the stored row as a free entry — which is why the client cannot decide from it", () => {
    const raw = store.get(KEY);
    expect(discoverizeState(raw)).toBe("registered");
    expect(mayPay(raw)).toBe(false);
  });

  it("overlays the shortlist so the event page can open the pay hand-off", async () => {
    const access = await resolveEventAccess(EV);
    expect(access.status).toBe("pending");
    expect(access.payment).toBe("awaiting");
    expect(access.round?.shortlistedAt).toBeTruthy();
    expect(access.awaitingReference).toBe(true);
    expect(discoverizeState({
      status: access.status!,
      payment: access.payment!,
      round: access.round ?? undefined,
    })).toBe("payment_pending");
    expect(mayPay({
      status: access.status!,
      payment: access.payment!,
      round: access.round ?? undefined,
    })).toBe(true);
    /* The overlay is a view. Storage stays a free registration until they pay. */
    expect(store.get(KEY).payment).toBe("not_required");
  });
});

describe("Pay ₹200 is wired to that view, then to JUNO", () => {
  const page = read("../components/event-page-view.tsx");
  const panel = read("../components/event-register-panel.tsx");
  const ticket = read("../app/ticket/page.tsx");
  const dialog = read("../components/registration-dialog.tsx");

  it("hands the event page the server shortlist, not the raw row", () => {
    const panelJsx = page.slice(page.indexOf("<EventRegisterPanel"));
    expect(panelJsx).toContain("round={access.round}");
    expect(panelJsx).toContain("viewerPayment={access.payment}");
  });

  it("opens the pay dialog from the event button and from ?finish=pay", () => {
    expect(panel).toContain('roundState === "payment_pending"');
    expect(panel).toContain('finish === "pay" && showPayRound');
    expect(panel).toContain('openToFinish("pay")');
    expect(panel).toContain('resumeAtPayment={resuming === "pay"}');
  });

  it("makes the My tickets control a link to that hand-off, not a button nested in one", () => {
    const pay = ticket.slice(ticket.lastIndexOf('state === "payment_pending"'));
    const control = pay.slice(0, pay.indexOf("DISCOVERIZE_SHORTLIST_CONGRATS"));
    expect(control).toContain("?finish=pay");
    expect(control).toContain("<Button asChild");
    expect(control).toContain("<a href={`/events/${a.eventId}?finish=pay`}>");
    /* In review is enough. Add sits in this box for a shortlisted lead,
       including payment submitted, and is not held back for confirmed. */
    const row = ticket.slice(ticket.indexOf("function DiscoverizeRow"));
    expect(row).toContain('a.status === "pending" || a.status === "confirmed"');
    expect(row).toContain("showAdd && team");
    expect(row).not.toMatch(/showAdd && a\.status === "confirmed"/);
    /* A <button> inside the <a> is what dropped the click on this site. */
    expect(control).not.toMatch(/<a[^>]*>\s*<Button/);
  });

  it("opens the same absolute JUNO url other paid events use, and only for a shortlisted payer", () => {
    expect(JUNO_PAYMENT_URL.startsWith("https://ruasportal.msruas.ac.in/")).toBe(true);
    expect(JUNO_PAYMENT_URL).toContain("eventID=208");
    expect(new URL(JUNO_PAYMENT_URL).origin).not.toBe("https://pravrutti.tech");
    expect(dialog).toContain("openPortal<Window>(JUNO_PAYMENT_URL");
    expect(dialog).toContain("if (discoverize && !payingRound) return;");
    expect(dialog).not.toMatch(/if \(discoverize\) return;/);
  });
});
