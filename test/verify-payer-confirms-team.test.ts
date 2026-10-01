import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/**
 * Verifying the payer is a decision about the whole team.
 *
 * Each row on the desk has its own "Verify payment" button, and each team
 * block has a separate "Confirm team" button. Pressing the per-person one on
 * the payer confirmed the payer alone — their teammates stayed "In review",
 * waiting on a decision that had already been taken, and nothing on the desk
 * would ever come back for them. It happened sixteen times in a day: Code
 * crews, Binary Brains, 404Found and the rest, every one from that button.
 *
 * The fee is one payment for the team. Once the payer's money is verified
 * there is nothing left to decide about the people it covers, so the button
 * now confirms them too. What it must never do is stamp anyone else as having
 * paid — a second "paid" row puts Rs. 400 in the books where Rs. 200 arrived —
 * or treat a teammate's row as proof of the payer's money.
 */

const store = new Map<string, any>();
const mailed: string[] = [];

vi.mock("@/lib/blob-store", () => ({
  listAll: async (prefix: string) =>
    [...store.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ url: "mem:" + k, pathname: k })),
  readPrivate: async (url: string) => store.get(url.slice(4)) ?? null,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  applicationPath: (e: string, m: string) => `app/${e}/${m}.json`,
  paymentRefPath: (ref: string) => "payment-ref/" + ref.trim().toLowerCase() + ".json",
  putJson: async (p: string, d: unknown) => { store.set(p, d); },
}));
vi.mock("@/lib/roles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/roles")>()),
  resolveRole: async () => ({ kind: "organiser" }),
}));
vi.mock("@/lib/identity", () => ({ resolveEmail: async () => "aryan@pravrutti.test", authRequired: () => false }));
vi.mock("@/lib/mailer", () => ({ mailerConfigured: () => true }));
vi.mock("@/lib/ticket-qr", () => ({ ticketQrDataUrl: async () => "data:image/png;base64,xx" }));
vi.mock("@/lib/confirmation-email", () => ({
  sendConfirmationEmail: async (a: any) => { mailed.push(a.email); return { sent: true }; },
}));

let POST: typeof import("@/app/api/dashboard/applications/route").POST;
beforeAll(async () => {
  ({ POST } = await import("@/app/api/dashboard/applications/route"));
});

const EV = "chaos", CODE = "FYCUWGB29ZDD";
const PAYER = "gopinath@x.com", MATE = "skanda@x.com", MATE2 = "third@x.com";

const verify = async (email: string, eventId = EV) => {
  const res = await POST(new Request("http://t/api/dashboard/applications", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "verify_payment", eventId, email }),
  }));
  return { status: res.status, body: await res.json() };
};

const row = (email: string, over: Record<string, unknown> = {}, eventId = EV) =>
  store.set(`app/${eventId}/${email}.json`, {
    ticketId: "PRV-" + email[0].toUpperCase(), eventId, eventName: eventId.toUpperCase(),
    status: "pending", payment: "not_required", fee: "Covered by team lead",
    name: email.split("@")[0], email, phone: "9876543210", college: "RUAS",
    teamName: "Code crews", teamCode: CODE, paymentRef: null,
    appliedAt: "2026-09-28T11:00:00.000Z", ...over,
  });
const read = (email: string, eventId = EV) => store.get(`app/${eventId}/${email}.json`);

beforeEach(() => {
  store.clear(); mailed.length = 0;
  row(PAYER, { payment: "awaiting", fee: "Rs. 200/-", paymentRef: "6CNLNRE6BAMJ1QQ" });
  row(MATE);
});

describe("verifying the payer's money", () => {
  it("confirms the payer and the teammates their fee covers", async () => {
    const res = await verify(PAYER);
    expect(res.status).toBe(200);
    expect(read(PAYER).status).toBe("confirmed");
    expect(read(MATE).status).toBe("confirmed");
  });

  it("tells the desk which teammates moved, so the page can show them", async () => {
    const res = await verify(PAYER);
    expect(res.body.application.email).toBe(PAYER);
    expect(res.body.teammates.map((t: any) => t.email)).toEqual([MATE]);
    expect(res.body.teammates[0].status).toBe("confirmed");
  });

  it("sends each teammate their ticket", async () => {
    await verify(PAYER);
    expect(mailed.sort()).toEqual([PAYER, MATE].sort());
  });

  /* One Rs. 200, recorded once, against the person who paid it. */
  it("records the money against the payer alone", async () => {
    await verify(PAYER);
    expect(read(PAYER).payment).toBe("paid");
    expect(read(PAYER).paymentVerifiedBy).toBe("aryan@pravrutti.test");
    expect(read(MATE).payment).toBe("not_required");
    expect(read(MATE).paymentVerifiedBy).toBeUndefined();
  });

  /* Two people on one team both marked as owing is a registration mistake to
     sort out by hand — confirming the first must not quietly call the second
     paid as well. */
  it("never marks a second charged member as paid", async () => {
    row(MATE2, { payment: "awaiting", fee: "Rs. 200/-", paymentRef: "SOMEOTHERREF123" });
    await verify(PAYER);
    expect(read(MATE2).payment).toBe("awaiting");
    expect(read(MATE2).status).toBe("pending");
  });

  it("does not revive a teammate who withdrew", async () => {
    row(MATE2, { status: "cancelled", cancelledAt: "2026-09-29T00:00:00.000Z" });
    await verify(PAYER);
    expect(read(MATE2).status).toBe("cancelled");
    expect(mailed).not.toContain(MATE2);
  });

  it("leaves a teammate who is already confirmed alone, without a second ticket", async () => {
    row(MATE2, { status: "confirmed", confirmationEmailAt: "2026-09-29T00:00:00.000Z" });
    await verify(PAYER);
    expect(mailed).not.toContain(MATE2);
  });

  /* The team code is shared across events when a team moves; the decision is
     about this event's team only. */
  it("only reaches teammates on this event", async () => {
    row(MATE2, {}, "hacktivate");
    await verify(PAYER);
    expect(read(MATE2, "hacktivate").status).toBe("pending");
  });

  it("works exactly as before for someone who entered alone", async () => {
    store.clear();
    row(PAYER, { payment: "awaiting", fee: "Rs. 200/-", paymentRef: "6CNLNRE6BAMJ1QQ", teamCode: null, teamName: null });
    const res = await verify(PAYER);
    expect(read(PAYER).status).toBe("confirmed");
    expect(res.body.teammates).toEqual([]);
  });
});

describe("what verifying a teammate's row does not do", () => {
  /* A teammate owes nothing, so their row is no evidence the payer paid.
     Approving them must not approve the payer's unchecked money. */
  it("confirms only that teammate and leaves the payer's money unverified", async () => {
    await verify(MATE);
    expect(read(MATE).status).toBe("confirmed");
    expect(read(PAYER).status).toBe("pending");
    expect(read(PAYER).payment).toBe("awaiting");
  });
});

describe("Discoverize", () => {
  /* Its confirm means "through to the final round", and only the judges'
     shortlist gets a team there. The guard on the payer holds for the team. */
  it("moves nobody on an unshortlisted team", async () => {
    store.clear();
    const D = "discoverize-research-paper-presentation";
    row(PAYER, { payment: "awaiting", fee: "Rs. 200/-" }, D);
    row(MATE, {}, D);
    await verify(PAYER, D);
    expect(read(PAYER, D).status).toBe("pending");
    expect(read(MATE, D).status).toBe("pending");
  });
});
