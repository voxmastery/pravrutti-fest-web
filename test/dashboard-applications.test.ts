import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { readPaymentRef } from "@/lib/applications";

const apps: any[] = [];
const store = new Map<string, any>();

vi.mock("@/lib/blob-store", () => ({
  listAll: async () => apps.map((_, i) => ({ pathname: `p${i}`, url: `u${i}` })),
  readPrivate: async (url: string) => apps[Number(url.slice(1))],
  applicationPath: (evId: string, email: string) => `app/${evId}/${email}.json`,
  teamPath: (evId: string, code: string) => `team/${evId}/${code}.json`,
  paymentRefPath: (ref: string) => "payment-ref/" + ref.trim().toLowerCase() + ".json",
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  putJson: async (p: string, data: unknown) => {
    store.set(p, data);
  },
}));

const role = vi.hoisted(() => ({ current: { kind: "organiser" } as { kind: string } }));
vi.mock("@/lib/roles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/roles")>()),
  resolveRole: async () => role.current,
}));
vi.mock("@/lib/identity", () => ({ resolveEmail: async () => "boss@pravrutti.test", authRequired: () => false }));
vi.mock("@/lib/mailer", () => ({ mailerConfigured: () => true }));
vi.mock("@/lib/ticket-qr", () => ({ ticketQrDataUrl: async () => "data:image/png;base64,xx" }));
vi.mock("@/lib/confirmation-email", () => ({
  sendConfirmationEmail: async () => ({ sent: false, skipped: true }),
}));

let GET: typeof import("@/app/api/dashboard/applications/route").GET;
let POST: typeof import("@/app/api/dashboard/applications/route").POST;

beforeAll(async () => {
  ({ GET, POST } = await import("@/app/api/dashboard/applications/route"));
});

const get = () => GET(new Request("http://t/api/dashboard/applications"));

const lead = {
  ticketId: "PRV-LEAD",
  eventId: "robo-race",
  eventName: "Robo Race",
  status: "pending",
  payment: "awaiting",
  fee: "Rs. 200/-",
  name: "Asha Rao",
  email: "asha@example.com",
  phone: "9876543210",
  college: "RUAS",
  teamName: "Bolt",
  teamCode: "ABCD23EFGH45",
  members: null,
  paymentRef: "4183 7712 9930",
  appliedAt: "2026-09-01T10:00:00.000Z",
};

const joiner = {
  ticketId: "PRV-JOIN",
  eventId: "robo-race",
  eventName: "Robo Race",
  status: "pending",
  payment: "not_required",
  fee: "Covered by team lead",
  name: "Ravi Kumar",
  email: "ravi@example.com",
  phone: "9876543211",
  college: "RUAS",
  teamName: "Bolt",
  teamCode: "ABCD23EFGH45",
  members: null,
  appliedAt: "2026-09-01T11:00:00.000Z",
};

beforeEach(() => {
  role.current = { kind: "organiser" };
  apps.length = 0;
  apps.push(lead, joiner);
  store.clear();
  store.set("app/robo-race/asha@example.com.json", { ...lead });
});

describe("readPaymentRef", () => {
  it("returns the stored id and never invents one", () => {
    expect(readPaymentRef("4183 7712 9930")).toBe("4183 7712 9930");
    expect(readPaymentRef("  UTR-9  ")).toBe("UTR-9");
    expect(readPaymentRef(null)).toBe("");
    expect(readPaymentRef(undefined)).toBe("");
    expect(readPaymentRef("")).toBe("");
  });
});

describe("GET /api/dashboard/applications", () => {
  it("returns the payment ID the lead typed at registration", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const body = await res.json();
    const asha = body.applications.find((a: { email: string }) => a.email === "asha@example.com");
    expect(asha.paymentRef).toBe("4183 7712 9930");
  });

  it("does not invent a payment ID for a free joiner", async () => {
    const body = await (await get()).json();
    const ravi = body.applications.find((a: { email: string }) => a.email === "ravi@example.com");
    expect(ravi.payment).toBe("not_required");
    expect(ravi.paymentRef).toBeNull();
  });

  it("refuses a coordinator — this desk holds every event's money fields", async () => {
    role.current = { kind: "coordinator" };
    expect((await get()).status).toBe(403);
  });

  /* The coordinators' shortlist lives in code, not on the row. A listed
     Discoverize lead is still stored as a free registration; this desk has
     to read that view or the row stays "Approve" and never appears under
     Payment due. A teammate is shortlisted and still owes nothing. An
     unlisted Discoverize team, and the same address on another event, stay
     exactly as stored — and the store itself is not written. */
  it("shows a shortlisted Discoverize lead as Rs. 200/- due and leaves everyone else free", async () => {
    const DISC = "discoverize-research-paper-presentation";
    const LISTED = "kssambavi06@gmail.com";
    const MATE = "agna.nelson682@gmail.com";
    const STRANGER = "not.shortlisted@example.com";
    const CODE = "RECHARGE0001";
    const disc = (email: string, over: Record<string, unknown> = {}) => ({
      ticketId: "PRV-D",
      eventId: DISC,
      eventName: "Discoverize (Research Paper Presentation)",
      status: "pending",
      payment: "not_required",
      fee: "Free",
      name: email.split("@")[0],
      email,
      phone: "9876543210",
      college: "RUAS",
      teamName: "Recharge",
      teamCode: CODE,
      members: null,
      appliedAt: "2026-10-02T09:00:00.000Z",
      ...over,
    });
    const listed = disc(LISTED);
    const mate = disc(MATE, { fee: "Covered by team lead" });
    const stranger = disc(STRANGER, { teamCode: null, teamName: null });
    const otherEvent = disc(LISTED, {
      eventId: "chaos",
      eventName: "CHAOS",
      teamCode: null,
      teamName: null,
      ticketId: "PRV-C",
    });
    apps.push(listed, mate, stranger, otherEvent);
    store.set(`team/${DISC}/${CODE}.json`, {
      code: CODE,
      eventId: DISC,
      name: "Recharge",
      createdByEmail: LISTED,
      members: [],
    });
    store.set(`app/${DISC}/${LISTED}.json`, { ...listed });

    const body = await (await get()).json();
    const by = (eventId: string, email: string) =>
      body.applications.find((a: { eventId: string; email: string }) => a.eventId === eventId && a.email === email);

    const lead = by(DISC, LISTED);
    expect(lead.payment).toBe("awaiting");
    expect(lead.fee).toBe("Rs. 200/-");
    expect(lead.round?.shortlistedAt).toBeTruthy();
    expect(lead.paymentRef).toBeNull();

    const teammate = by(DISC, MATE);
    expect(teammate.payment).toBe("not_required");
    expect(teammate.fee).toBe("Covered by team lead");
    expect(teammate.round?.shortlistedAt).toBeTruthy();

    const unlisted = by(DISC, STRANGER);
    expect(unlisted.payment).toBe("not_required");
    expect(unlisted.fee).toBe("Free");
    expect(unlisted.round).toBeUndefined();

    const chaos = by("chaos", LISTED);
    expect(chaos.payment).toBe("not_required");
    expect(chaos.fee).toBe("Free");
    expect(chaos.round).toBeUndefined();

    expect(body.totals.awaitingPayment).toBe(2);
    expect(store.get(`app/${DISC}/${LISTED}.json`).payment).toBe("not_required");
    expect(store.get(`app/${DISC}/${LISTED}.json`).fee).toBe("Free");
  });
});

describe("POST /api/dashboard/applications set_payment_ref", () => {
  it("lets an organiser edit the stored payment ID", async () => {
    const res = await POST(
      new Request("http://t/api/dashboard/applications", {
        method: "POST",
        body: JSON.stringify({
          action: "set_payment_ref",
          eventId: "robo-race",
          email: "asha@example.com",
          paymentRef: "UTR-UPDATED",
        }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.application.paymentRef).toBe("UTR-UPDATED");
    expect(store.get("app/robo-race/asha@example.com.json").paymentRef).toBe("UTR-UPDATED");
  });
});
