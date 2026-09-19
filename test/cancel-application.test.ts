import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import type { Application } from "@/lib/applications";

/* Cancelling is the applicant's own withdrawal, distinct from an organiser
   declining them. The row is kept rather than deleted so the desk can still see
   who dropped out, and a fee that was actually collected is marked refundable
   rather than silently vanishing. */

const store = new Map<string, any>();

vi.mock("@/lib/blob-store", () => ({
  applicationPath: (evId: string, email: string) => `app/${evId}/${email}.json`,
  paymentRefPath: (ref: string) => "payment-ref/" + ref.trim().toLowerCase() + ".json",
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  putJson: async (p: string, data: unknown) => { store.set(p, data); },
}));
vi.mock("@/lib/confirmation-email", () => ({
  sendConfirmationEmail: async () => ({ sent: true }),
}));

let cancelApplication: typeof import("@/lib/payment-review").cancelApplication;
beforeAll(async () => {
  ({ cancelApplication } = await import("@/lib/payment-review"));
});

const EVENT = "robo-race";
const EMAIL = "asha@example.com";
const path = `app/${EVENT}/${EMAIL}.json`;

const seed = (over: Partial<Application> = {}) => {
  store.set(path, {
    ticketId: "PRV-1", eventId: EVENT, eventName: "ROBO RACE",
    status: "pending", payment: "awaiting", fee: "Rs. 200/-",
    name: "Asha", email: EMAIL, phone: "9876543210", college: "RIT",
    teamName: null, members: null, appliedAt: "2026-09-01T00:00:00.000Z",
    ...over,
  });
};

beforeEach(() => store.clear());

describe("cancelApplication", () => {
  it("returns null when there is no such application", async () => {
    expect(await cancelApplication({ eventId: EVENT, email: EMAIL })).toBeNull();
  });

  it("marks a pending application cancelled and frees the place", async () => {
    seed();
    const out = await cancelApplication({ eventId: EVENT, email: EMAIL });
    expect(out!.application.status).toBe("cancelled");
    expect(store.get(path).status).toBe("cancelled");
    expect(store.get(path).cancelledAt).toBeTruthy();
  });

  /* Nothing was collected yet, so there is nothing to refund — marking it
     refunded would claim money moved that never did. */
  it("leaves an unpaid fee alone", async () => {
    seed({ payment: "awaiting" });
    const out = await cancelApplication({ eventId: EVENT, email: EMAIL });
    expect(out!.application.payment).toBe("awaiting");
    expect(out!.application.refundedAt).toBeUndefined();
  });

  it("marks a verified payment refundable", async () => {
    seed({ status: "confirmed", payment: "paid" });
    const out = await cancelApplication({ eventId: EVENT, email: EMAIL });
    expect(out!.application.status).toBe("cancelled");
    expect(out!.application.payment).toBe("refunded");
    expect(out!.application.refundedAt).toBeTruthy();
  });

  /* A joiner's fee belongs to their lead; cancelling must not rewrite that
     into a refund owed to them. */
  it("never turns a joiner's covered fee into a refund", async () => {
    seed({ payment: "not_required" });
    const out = await cancelApplication({ eventId: EVENT, email: EMAIL });
    expect(out!.application.payment).toBe("not_required");
  });

  /* Already closed by the organisers — cancelling must not overwrite that
     decision or the refund trail attached to it. */
  it("leaves a declined application as declined", async () => {
    seed({ status: "declined" });
    const out = await cancelApplication({ eventId: EVENT, email: EMAIL });
    expect(out!.application.status).toBe("declined");
  });

  it("is idempotent — cancelling twice keeps the first cancellation", async () => {
    seed();
    const first = await cancelApplication({ eventId: EVENT, email: EMAIL });
    const second = await cancelApplication({ eventId: EVENT, email: EMAIL });
    expect(second!.application.cancelledAt).toBe(first!.application.cancelledAt);
  });
});
