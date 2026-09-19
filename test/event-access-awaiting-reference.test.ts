import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/* Somebody who went to pay already has a registration, so the page hides
   "Request to join". The step that takes the transaction ID lived only in the
   tab they were told to leave — without this flag there is no way back to it. */

const store = new Map<string, any>();
const identity = vi.hoisted(() => ({ email: "student@example.com" as string | null }));

vi.mock("@/lib/blob-store", () => ({
  applicationPath: (e: string, m: string) => `app/${e}/${m}.json`,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
}));
vi.mock("@/lib/identity", () => ({ resolveEmail: async () => identity.email }));
vi.mock("@/lib/roles", () => ({
  resolveRole: async () => ({ kind: "none" }),
  canViewEvent: () => false,
}));

let resolveEventAccess: typeof import("@/lib/event-access").resolveEventAccess;
beforeAll(async () => { ({ resolveEventAccess } = await import("@/lib/event-access")); });

const EV = "the-logic-circuit";
const app = (over: Record<string, unknown>) => {
  store.set(`app/${EV}/student@example.com.json`, {
    ticketId: "PRV-1", eventId: EV, email: "student@example.com",
    status: "pending", payment: "awaiting", ...over,
  });
};

beforeEach(() => { store.clear(); identity.email = "student@example.com"; });

describe("whether somebody still owes us a transaction ID", () => {
  it("says yes for a registration written when they left to pay", async () => {
    app({ paymentRef: null });
    expect((await resolveEventAccess(EV)).awaitingReference).toBe(true);
  });

  it("says no once they have come back with one", async () => {
    app({ paymentRef: "JUNO-2026-0091" });
    expect((await resolveEventAccess(EV)).awaitingReference).toBe(false);
  });

  /* A teammate owes nothing — their lead's fee covers them, so there is no
     reference for them to be missing. */
  it("says no for somebody whose entry is covered by their lead", async () => {
    app({ payment: "not_required", paymentRef: null });
    expect((await resolveEventAccess(EV)).awaitingReference).toBe(false);
  });

  it("says no once the payment has been verified", async () => {
    app({ payment: "paid", paymentRef: "JUNO-2026-0091" });
    expect((await resolveEventAccess(EV)).awaitingReference).toBe(false);
  });

  /* A withdrawn registration is not something to finish. */
  it("says no for a cancelled registration", async () => {
    app({ status: "cancelled", paymentRef: null });
    expect((await resolveEventAccess(EV)).awaitingReference).toBe(false);
  });

  it("says no for somebody who never applied", async () => {
    expect((await resolveEventAccess(EV)).awaitingReference).toBe(false);
  });

  it("says no to a signed-out visitor", async () => {
    identity.email = null;
    expect((await resolveEventAccess(EV)).awaitingReference).toBe(false);
  });
});
