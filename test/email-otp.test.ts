import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OTP_MAX_ATTEMPTS,
  OTP_MAX_SENDS,
  OTP_TTL_MS,
  decideIp,
  decideIssue,
  decideVerify,
  hashOtpCode,
  newOtpCode,
  normalizeLoginEmail,
  otpMail,
  type OtpRecord,
} from "@/lib/email-otp";

const store = vi.hoisted(() => new Map<string, unknown>());
const sent = vi.hoisted(() => [] as { to: string; subject: string; text: string; html: string }[]);
const sendOk = vi.hoisted(() => ({ value: true }));

vi.mock("@/lib/blob-store", () => ({
  casUpdate: async (path: string, decide: (current: unknown) => Promise<{ write: boolean; next: unknown }> | { write: boolean; next: unknown }) => {
    const current = store.has(path) ? store.get(path) : null;
    const decision = await decide(current);
    if (!decision.write || decision.next == null) return { current, written: false, next: current };
    store.set(path, structuredClone(decision.next));
    return { current, written: true, next: decision.next };
  },
}));

vi.mock("@/lib/mailer", () => ({
  mailerConfigured: () => true,
  sendMail: async (mail: { to: string; subject: string; text: string; html: string }) => {
    if (!sendOk.value) return { sent: false, skipped: false };
    sent.push(mail);
    return { sent: true };
  },
}));

import { consumeEmailOtp, requestEmailOtp } from "@/lib/email-otp-service";
import { POST } from "@/app/api/auth/otp/request/route";

const SECRET = "otp-test-secret-value";
const EMAIL = "student@msrit.edu";

beforeEach(() => {
  store.clear();
  sent.length = 0;
  sendOk.value = true;
  process.env.NEXTAUTH_SECRET = SECRET;
  delete process.env.OTP_SECRET;
});

afterEach(() => {
  delete process.env.NEXTAUTH_SECRET;
  delete process.env.OTP_SECRET;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
});

describe("email OTP policy", () => {
  it("accepts a college address and rejects anything that is not one inbox", () => {
    expect(normalizeLoginEmail("  Student@MSRIT.edu ")).toBe(EMAIL);
    expect(normalizeLoginEmail("not an email")).toBeNull();
    expect(normalizeLoginEmail("a@b.c")).toBeNull();
    expect(normalizeLoginEmail("a b@msrit.edu")).toBeNull();
  });

  it("hashes the code with the address so a code cannot move between inboxes", () => {
    const code = "042813";
    const hash = hashOtpCode(EMAIL, code, SECRET);
    expect(hash).toHaveLength(64);
    expect(hash).not.toBe(code);
    expect(hashOtpCode("other@msrit.edu", code, SECRET)).not.toBe(hash);
  });

  it("issues a code that expires in ten minutes, then refuses a second one inside a minute", () => {
    const now = 1_700_000_000_000;
    const first = decideIssue(null, EMAIL, "hash-1", now);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.record.expiresAt - now).toBe(OTP_TTL_MS);
    expect(first.record.attempts).toBe(0);
    const again = decideIssue(first.record, EMAIL, "hash-2", now + 5_000);
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.reason).toBe("too_soon");
  });

  it("stops after five codes in an hour and allows another once the oldest falls out", () => {
    let current: OtpRecord | null = null;
    const start = 1_700_000_000_000;
    for (let i = 0; i < OTP_MAX_SENDS; i++) {
      const decision = decideIssue(current, EMAIL, `hash-${i}`, start + i * 61_000);
      expect(decision.ok).toBe(true);
      if (!decision.ok) return;
      current = decision.record;
    }
    const blocked = decideIssue(current, EMAIL, "hash-x", start + OTP_MAX_SENDS * 61_000);
    expect(blocked.ok).toBe(false);
    const later = decideIssue(current, EMAIL, "hash-y", start + 60 * 60 * 1000 + 1);
    expect(later.ok).toBe(true);
  });

  it("spends the code on a match and locks the inbox after five wrong tries", () => {
    const now = 1_700_000_000_000;
    const issued = decideIssue(null, EMAIL, hashOtpCode(EMAIL, "111111", SECRET), now);
    if (!issued.ok) throw new Error("issue");
    const good = decideVerify(issued.record, EMAIL, hashOtpCode(EMAIL, "111111", SECRET), now + 1000);
    expect(good.ok).toBe(true);
    if (!good.ok) return;
    expect(good.next.consumed).toBe(true);
    expect(good.next.codeHash).toBe("");
    expect(good.write).toBe(true);
    const reuse = decideVerify(good.next, EMAIL, hashOtpCode(EMAIL, "111111", SECRET), now + 2000);
    expect(reuse.ok).toBe(false);

    let record = issued.record;
    for (let i = 1; i <= OTP_MAX_ATTEMPTS; i++) {
      const wrong = decideVerify(record, EMAIL, hashOtpCode(EMAIL, "000000", SECRET), now + i);
      expect(wrong.ok).toBe(false);
      if (wrong.ok) return;
      expect(wrong.write).toBe(true);
      expect(wrong.error).toBe(i === OTP_MAX_ATTEMPTS ? "Too many tries. Request a new code." : "That code is wrong.");
      record = wrong.next!;
    }
    expect(record.codeHash).toBe("");
    const after = decideVerify(record, EMAIL, hashOtpCode(EMAIL, "111111", SECRET), now + 10);
    expect(after.ok).toBe(false);
    if (!after.ok) expect(after.write).toBe(false);
  });

  it("caps how many codes one network can ask for", () => {
    let hits = null as { hits: number[] } | null;
    const now = 1_700_000_000_000;
    for (let i = 0; i < 20; i++) {
      const decision = decideIp(hits, now + i);
      expect(decision.ok).toBe(true);
      if (!decision.ok) return;
      hits = decision.next;
    }
    expect(decideIp(hits, now + 21).ok).toBe(false);
  });

  it("is a sign-in code and nothing else", () => {
    const mail = otpMail("123456");
    expect(mail.subject).toBe("Your Pravrutti sign-in code");
    expect(mail.text).toContain("123456");
    expect(mail.text.toLowerCase()).not.toContain("ticket");
    expect(mail.html.toLowerCase()).not.toContain("qr");
    expect(newOtpCode()).toMatch(/^\d{6}$/);
  });
});

describe("email OTP delivery", () => {
  it("sends exactly one sign-in email and then accepts only that code", async () => {
    const now = 1_700_000_000_000;
    const issued = await requestEmailOtp(EMAIL, "203.0.113.8", now);
    expect(issued).toEqual({ ok: true });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(EMAIL);
    expect(sent[0].subject).toBe("Your Pravrutti sign-in code");
    expect(sent[0].text).not.toMatch(/PRAVRUTTI ticket/i);
    const code = sent[0].text.match(/\b(\d{6})\b/)?.[1];
    expect(code).toBeTruthy();

    const wrong = await consumeEmailOtp(EMAIL, "000000", now + 1000);
    expect(wrong.ok).toBe(false);
    const right = await consumeEmailOtp(EMAIL, code, now + 2000);
    expect(right).toEqual({ ok: true, email: EMAIL });
    const again = await consumeEmailOtp(EMAIL, code, now + 3000);
    expect(again.ok).toBe(false);
  });

  it("does not hand the code back, and does not mail when the address is limited", async () => {
    const now = 1_700_000_000_000;
    await requestEmailOtp(EMAIL, "203.0.113.9", now);
    const second = await requestEmailOtp(EMAIL, "203.0.113.9", now + 1000);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.status).toBe(429);
    expect(sent).toHaveLength(1);
  });

  it("forgets a code the mailbox refused, without opening the throttle", async () => {
    const now = 1_700_000_000_000;
    sendOk.value = false;
    const failed = await requestEmailOtp(EMAIL, "203.0.113.10", now);
    expect(failed.ok).toBe(false);
    if (!failed.ok) expect(failed.status).toBe(503);
    expect(sent).toHaveLength(0);
    sendOk.value = true;
    const retry = await requestEmailOtp(EMAIL, "203.0.113.10", now + 1000);
    expect(retry.ok).toBe(false);
    if (!retry.ok) expect(retry.status).toBe(429);
  });

  it("says codes are unavailable when there is no secret to hash with", async () => {
    delete process.env.NEXTAUTH_SECRET;
    const result = await requestEmailOtp(EMAIL, "203.0.113.11");
    expect(result).toMatchObject({ ok: false, status: 503 });
    expect(sent).toHaveLength(0);
  });
});

describe("POST /api/auth/otp/request", () => {
  function call(body: string, headers: Record<string, string> = {}) {
    return POST(
      new Request("https://pravrutti.tech/api/auth/otp/request", {
        method: "POST",
        headers: { host: "pravrutti.tech", "content-type": "application/json", ...headers },
        body,
      }),
    );
  }

  it("answers without the code", async () => {
    const res = await call(JSON.stringify({ email: EMAIL }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(JSON.stringify(json)).not.toMatch(/\d{6}/);
    expect(sent).toHaveLength(1);
  });

  it("refuses a request whose page is not this site", async () => {
    const before = sent.length;
    const res = await call(JSON.stringify({ email: EMAIL }), { origin: "https://evil.example" });
    expect(res.status).toBe(403);
    expect(sent).toHaveLength(before);
  });

  it("rejects a body that is not JSON", async () => {
    const res = await call("{");
    expect(res.status).toBe(400);
    expect(sent).toHaveLength(0);
  });
});

describe("email OTP session", () => {
  it("keeps Google and signs the code user in as that email, with no display name", async () => {
    process.env.GOOGLE_CLIENT_ID = "google-client";
    process.env.GOOGLE_CLIENT_SECRET = "google-secret";
    process.env.NEXTAUTH_SECRET = SECRET;
    vi.resetModules();
    const { authOptions, googleAuthEnabled } = await import("@/lib/auth");
    expect(googleAuthEnabled).toBe(true);
    const google = authOptions.providers.find((provider) => provider.options?.id === undefined && provider.type === "oauth");
    expect(google?.options?.authorization?.params).toMatchObject({
      prompt: "select_account",
      access_type: "online",
      scope: "openid email profile",
    });

    const otp = authOptions.providers.find((provider) => provider.options?.id === "email-otp");
    expect(otp?.options?.authorize).toBeTypeOf("function");

    const now = Date.now();
    await requestEmailOtp("Ada@College.edu", "203.0.113.12", now);
    const code = sent.at(-1)?.text.match(/\b(\d{6})\b/)?.[1];
    const user = await otp!.options.authorize({ email: "Ada@College.edu", code }, {});
    expect(user).toEqual({ id: "ada@college.edu", email: "ada@college.edu", name: null });

    const callbacks = authOptions.callbacks!;
    expect(await callbacks.signIn!({ account: { provider: "email-otp" }, profile: undefined } as never)).toBe(true);
    expect(
      await callbacks.signIn!({
        account: { provider: "google" },
        profile: { email_verified: false },
      } as never),
    ).toBe(false);
    expect(
      await callbacks.signIn!({
        account: { provider: "google" },
        profile: { email: "Person@Gmail.com", email_verified: true },
      } as never),
    ).toBe(true);

    const token = await callbacks.jwt!({
      token: { email: "stale@old.test" },
      user: { id: "ada@college.edu", email: "Ada@College.edu", name: null },
      account: { provider: "email-otp" },
      profile: undefined,
      trigger: "signIn",
    } as never);
    expect(token.email).toBe("ada@college.edu");

    const session = await callbacks.session!({
      session: { user: { email: "Ada@College.edu", name: null }, expires: "2099-01-01" },
      token: { email: "ada@college.edu" },
    } as never);
    expect(session.user?.email).toBe("ada@college.edu");
  });
});
