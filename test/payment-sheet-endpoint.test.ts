import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/* The endpoint behind "approve everyone the payment report pays for". It
   confirms places and sends tickets, so every guard on it is tested: who may
   call it, that a plan writes nothing, and that it re-checks each row at the
   moment it acts rather than trusting the browser. */

const store = new Map<string, any>();
const sentMail: string[] = [];
const role = vi.hoisted(() => ({ value: { kind: "none" } as any, email: "org@example.com" as string | null }));

vi.mock("@/lib/blob-store", () => ({
  listAll: async (prefix: string) =>
    [...store.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ url: "mem:" + k })),
  readPrivate: async (url: string) => store.get(url.slice(4)) ?? null,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  applicationPath: (e: string, m: string) => `app/${e}/${m}.json`,
  teamPath: (e: string, c: string) => `team/${e}/${c}.json`,
  teamMemberPath: (e: string, m: string) => `team-member/${e}/${m}.json`,
  putJson: async (p: string, d: unknown) => { store.set(p, d); },
}));
vi.mock("@/lib/roles", () => ({ resolveRole: async () => role.value }));
vi.mock("@/lib/identity", () => ({ resolveEmail: async () => role.email }));
vi.mock("@/lib/confirmation-email", () => ({
  sendConfirmationEmail: async (r: any) => { sentMail.push(r.email); return { sent: true }; },
}));

let POST: typeof import("@/app/api/dashboard/payment-sheet/route").POST;
beforeAll(async () => { ({ POST } = await import("@/app/api/dashboard/payment-sheet/route")); });

const post = async (body: unknown) => {
  const res = await POST(new Request("http://t/api/dashboard/payment-sheet", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }));
  return { status: res.status, body: await res.json() };
};

const EV = "chaos";
const row = (email: string, over: Record<string, unknown> = {}) => {
  store.set(`app/${EV}/${email}.json`, {
    ticketId: "PRV-" + email[0].toUpperCase(), eventId: EV, eventName: "CHAOS",
    status: "pending", payment: "awaiting", fee: "Rs. 200/-", name: email.split("@")[0], email,
    phone: "9", college: "RUAS", teamName: null, teamCode: null, paymentRef: null,
    appliedAt: "2026-09-16T09:00:00.000Z", ...over,
  });
};
const read = (email: string) => store.get(`app/${EV}/${email}.json`);

const GRID = [
  ["", "MS Ramaiah University of Applied Sciences"],
  ["Sr.No", "Name", "Email ID", "Payment Amount / Status", "Transaction Date", "Transaction Number"],
  [1, "Paid Person", "paid@example.com", "200.00292", "2026-09-16 12:38:16.0", "XSKR2QZ2USANLKE"],
];

beforeEach(() => {
  store.clear(); sentMail.length = 0;
  role.value = { kind: "organiser" }; role.email = "org@example.com";
});

describe("POST /api/dashboard/payment-sheet", () => {
  it("is closed to everyone but organisers", async () => {
    role.value = { kind: "coordinator", eventIds: [EV] };
    expect((await post({ action: "plan", rows: GRID })).status).toBe(403);
    role.value = { kind: "none" };
    expect((await post({ action: "approve", items: [{ eventId: EV, email: "paid@example.com" }] })).status).toBe(403);
  });

  it("plans without writing anything", async () => {
    /* CHAOS / ELECTROXCAPE / DENT are marked full, so a plan on them would
       hold the row out of approve. Discoverize is the only non-full event. */
    row("paid@example.com", {
      eventId: "discoverize-research-paper-presentation",
      eventName: "Discoverize (Research Paper Presentation)",
    });
    const res = await post({ action: "plan", rows: GRID });
    expect(res.status).toBe(200);
    expect(res.body.payments).toBe(1);
    expect(res.body.approve).toHaveLength(1);
    /* Nothing has changed yet. */
    expect(read("paid@example.com").status).toBe("pending");
    expect(sentMail).toEqual([]);
  });

  it("says so when the file is not the payment report", async () => {
    const res = await post({ action: "plan", rows: [["Sheet1"], ["nothing", "useful"]] });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/payment report/i);
  });

  it("confirms the person and records the reference from the report", async () => {
    row("paid@example.com");
    const res = await post({
      action: "approve",
      items: [{ eventId: EV, email: "paid@example.com", transaction: "XSKR2QZ2USANLKE" }],
    });
    expect(res.status).toBe(200);
    expect(res.body.done).toHaveLength(1);
    const saved = read("paid@example.com");
    expect(saved.status).toBe("confirmed");
    expect(saved.payment).toBe("paid");
    expect(saved.paymentRef).toBe("XSKR2QZ2USANLKE");
    expect(saved.paymentVerifiedBy).toBe("org@example.com");
    expect(sentMail).toEqual(["paid@example.com"]);
  });

  /* A whole team goes through on the lead's payment, and only the lead's row
     carries the money. */
  it("confirms a team together on one payment", async () => {
    row("lead@example.com", { teamCode: "TEAM1", teamName: "T" });
    row("mate@example.com", { teamCode: "TEAM1", teamName: "T", payment: "not_required" });
    const res = await post({ action: "approve", items: [{ eventId: EV, email: "lead@example.com" }] });
    expect(res.status).toBe(200);
    expect(res.body.done[0].confirmed).toBe(2);
    expect(read("lead@example.com").payment).toBe("paid");
    expect(read("mate@example.com").status).toBe("confirmed");
    expect(read("mate@example.com").payment).toBe("not_required");
  });

  /* The browser's plan can be minutes old. The row is re-read at the moment
     of writing, so a place confirmed or withdrawn meanwhile is not rewritten. */
  it("re-checks each row instead of trusting the plan it was sent", async () => {
    row("gone@example.com", { status: "cancelled" });
    row("done@example.com", { status: "confirmed", payment: "paid" });
    const res = await post({
      action: "approve",
      items: [
        { eventId: EV, email: "gone@example.com" },
        { eventId: EV, email: "done@example.com" },
        { eventId: EV, email: "missing@example.com" },
      ],
    });
    expect(res.body.done).toHaveLength(0);
    expect(res.body.failed.map((f: any) => f.error)).toEqual([
      "Already cancelled.", "Already confirmed.", "No registration found.",
    ]);
    expect(sentMail).toEqual([]);
  });

  it("keeps a reference the student already gave us", async () => {
    row("paid@example.com", { paymentRef: "MINE1234567890" });
    await post({ action: "approve", items: [{ eventId: EV, email: "paid@example.com" }] });
    expect(read("paid@example.com").paymentRef).toBe("MINE1234567890");
  });

  it("refuses an oversized batch rather than timing out halfway", async () => {
    const items = Array.from({ length: 9 }, (_, i) => ({ eventId: EV, email: `p${i}@example.com` }));
    const res = await post({ action: "approve", items });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at most 8/i);
  });

  it("carries on past one bad row and reports it", async () => {
    row("ok@example.com");
    const res = await post({
      action: "approve",
      items: [{ eventId: EV, email: "ok@example.com" }, { eventId: "", email: "" }],
    });
    expect(res.body.done).toHaveLength(1);
    expect(res.body.failed).toHaveLength(1);
    expect(read("ok@example.com").status).toBe("confirmed");
  });
});
