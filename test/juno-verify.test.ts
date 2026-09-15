import { describe, it, expect } from "vitest";
import { decideReconcile, type JunoPayCheck } from "@/lib/juno-verify";

const app = { email: "asha@example.com", junoRegId: "50123" };

describe("decideReconcile — Path B auto-verification decision", () => {
  /* Nothing to poll: the applicant never gave us a Juno registration ID, so
     there is no key to check and this one falls back to a human. */
  it("does not confirm when there is no reg id", () => {
    expect(decideReconcile({ email: app.email, junoRegId: null }, { state: "paid" })).toEqual({
      confirm: false,
      reason: "no-reg-id",
    });
  });

  /* The endpoint could not tell us — never confirm on silence. This is the
     safe default the stubbed checker returns until the spike proves the
     endpoint, so it must never approve anyone. */
  it("does not confirm on an unknown result", () => {
    expect(decideReconcile(app, { state: "unknown" }).confirm).toBe(false);
    expect(decideReconcile(app, { state: "unknown" }).reason).toBe("unknown");
  });

  it("does not confirm when the portal says unpaid", () => {
    expect(decideReconcile(app, { state: "unpaid" })).toEqual({ confirm: false, reason: "not-paid" });
  });

  it("confirms when paid and the portal returns no identity to contradict", () => {
    expect(decideReconcile(app, { state: "paid" })).toEqual({ confirm: true, reason: "paid" });
  });

  /* The spoof guard: someone could paste a stranger's paid reg id to jump the
     queue. If the portal hands back an email for that reg id and it is not the
     applicant's, we refuse — a paid reg id only confirms the person it belongs
     to. */
  it("refuses when the portal's email does not match the applicant", () => {
    const check: JunoPayCheck = { state: "paid", email: "someone.else@example.com" };
    expect(decideReconcile(app, check)).toEqual({ confirm: false, reason: "identity-mismatch" });
  });

  it("confirms when the portal's email matches, case- and space-insensitively", () => {
    const check: JunoPayCheck = { state: "paid", email: "  ASHA@Example.com " };
    expect(decideReconcile(app, check)).toEqual({ confirm: true, reason: "paid" });
  });

  /* An empty/absent identity from the portal is "no contradiction", not a
     mismatch — some responses may not carry the email at all. */
  it("treats a blank portal email as no contradiction", () => {
    expect(decideReconcile(app, { state: "paid", email: "" }).confirm).toBe(true);
    expect(decideReconcile(app, { state: "paid", email: null }).confirm).toBe(true);
  });
});
