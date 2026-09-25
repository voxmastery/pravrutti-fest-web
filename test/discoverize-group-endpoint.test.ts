import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/**
 * Who may have the WhatsApp invite.
 *
 * The group is for Discoverize teams. An invite link is a credential — anyone
 * holding it can walk into the group — so the rule is not "hide the button"
 * but "never send the string". Every refusal below is checked for the link
 * itself, not merely for a status code: a 403 whose body still carries the
 * URL would have leaked it to someone who opened the network tab.
 */

const store = new Map<string, any>();
const identity = vi.hoisted(() => ({ email: null as string | null }));

vi.mock("@/lib/blob-store", () => ({
  applicationPath: (e: string, m: string) => `app/${e}/${m}.json`,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
}));
vi.mock("@/lib/identity", () => ({ resolveEmail: async () => identity.email }));

let GET: typeof import("@/app/api/discoverize/group/route").GET;
let URL_: string;
beforeAll(async () => {
  ({ GET } = await import("@/app/api/discoverize/group/route"));
  ({ DISCOVERIZE_WHATSAPP_URL: URL_ } = await import("@/lib/discoverize-group"));
});

const DISC = "discoverize-research-paper-presentation";
const ME = "team@example.com";

const call = async () => {
  const res = await GET();
  const text = await res.text();
  let body: any = {}; try { body = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, body, text };
};

const row = (eventId: string, over: Record<string, unknown> = {}) =>
  store.set(`app/${eventId}/${ME}.json`, {
    ticketId: "PRV-1", eventId, eventName: "X", status: "pending", payment: "not_required",
    fee: "Free", name: "A Team", email: ME, phone: "9876543210", college: "RUAS",
    teamName: "Loopers", teamCode: "TEAM1", appliedAt: "2026-09-20T09:00:00.000Z", ...over,
  });

beforeEach(() => { store.clear(); identity.email = ME; });

describe("GET /api/discoverize/group — who gets the invite", () => {
  it("gives a registered Discoverize team the link and a QR", async () => {
    row(DISC);
    const r = await call();
    expect(r.status).toBe(200);
    expect(r.body.url).toBe(URL_);
    expect(r.body.qr).toMatch(/^data:image\/png;base64,/);
  });

  it("still gives it once the team is confirmed for the final round", async () => {
    row(DISC, { status: "confirmed" });
    expect((await call()).body.url).toBe(URL_);
  });

  /* The whole point of the request. */
  it("never sends it to someone registered only for another event", async () => {
    row("chaos");
    const r = await call();
    expect(r.status).toBe(403);
    expect(r.text).not.toContain("chat.whatsapp.com");
    expect(r.text).not.toContain(URL_);
  });

  it("never sends it to a signed-in stranger with no registration", async () => {
    const r = await call();
    expect(r.status).toBe(403);
    expect(r.text).not.toContain("chat.whatsapp.com");
  });

  it("never sends it to somebody not signed in", async () => {
    identity.email = null;
    row(DISC);
    const r = await call();
    expect(r.status).toBe(401);
    expect(r.text).not.toContain("chat.whatsapp.com");
  });

  it("withdraws it from a team that cancelled", async () => {
    row(DISC, { status: "cancelled" });
    const r = await call();
    expect(r.status).toBe(403);
    expect(r.text).not.toContain("chat.whatsapp.com");
  });

  it("withdraws it from a team that was declined", async () => {
    row(DISC, { status: "declined" });
    const r = await call();
    expect(r.status).toBe(403);
    expect(r.text).not.toContain("chat.whatsapp.com");
  });

  /* Registered for Discoverize AND something else: still a Discoverize team. */
  it("gives it to a team that also entered other events", async () => {
    row(DISC); row("chaos");
    expect((await call()).body.url).toBe(URL_);
  });

  it("is never cached by a CDN — the answer differs per person", async () => {
    row(DISC);
    const res = await GET();
    expect(res.headers.get("cache-control")).toMatch(/no-store|private/);
  });
});
