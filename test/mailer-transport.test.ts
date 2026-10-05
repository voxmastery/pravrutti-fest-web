import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Which way a ticket leaves.
 *
 * The fest mailbox on Hostinger sends 100 messages a day, rolling, and
 * invites share that allowance with tickets — so 832 confirmed students
 * were waiting on a ticket email with ten days to go. Resend has no daily
 * cap on its paid plan. So once a Resend key is configured, mail goes that
 * way first, and the mailbox is still there behind it: a Resend outage or a
 * rejected request falls back to SMTP instead of failing the send.
 */

const smtpSend = vi.fn(async () => ({}));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: smtpSend, verify: async () => true }) },
}));

const mail = { to: "student@example.com", subject: "Ticket", html: "<p>hi</p>", text: "hi" };
const fetchMock = vi.fn();
const SMTP = { SMTP_HOST: "smtp.hostinger.com", SMTP_USER: "no-reply@pravrutti.tech", SMTP_PASS: "x" };

async function send() {
  const { sendMail } = await import("@/lib/mailer");
  return sendMail(mail);
}
const setEnv = (vars: Record<string, string | undefined>) => {
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
};

beforeEach(() => {
  smtpSend.mockClear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  setEnv({ SMTP_HOST: undefined, SMTP_USER: undefined, SMTP_PASS: undefined, RESEND_API_KEY: undefined });
});
afterEach(() => vi.unstubAllGlobals());

describe("sendMail", () => {
  it("uses the mailbox when that is all there is", async () => {
    setEnv(SMTP);
    expect((await send()).sent).toBe(true);
    expect(smtpSend).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends through Resend first once a key is configured", async () => {
    setEnv({ ...SMTP, RESEND_API_KEY: "re_test" });
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    expect((await send()).sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(smtpSend).not.toHaveBeenCalled();
  });

  it("falls back to the mailbox when Resend refuses", async () => {
    setEnv({ ...SMTP, RESEND_API_KEY: "re_test" });
    fetchMock.mockResolvedValue(new Response("domain not verified", { status: 403 }));
    expect((await send()).sent).toBe(true);
    expect(smtpSend).toHaveBeenCalledTimes(1);
  });

  it("falls back to the mailbox when Resend cannot be reached", async () => {
    setEnv({ ...SMTP, RESEND_API_KEY: "re_test" });
    fetchMock.mockRejectedValue(new Error("network down"));
    expect((await send()).sent).toBe(true);
    expect(smtpSend).toHaveBeenCalledTimes(1);
  });

  it("uses Resend alone when there is no mailbox", async () => {
    setEnv({ RESEND_API_KEY: "re_test" });
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    expect((await send()).sent).toBe(true);
    expect(smtpSend).not.toHaveBeenCalled();
  });

  it("reports Resend's refusal when there is no mailbox to fall back to", async () => {
    setEnv({ RESEND_API_KEY: "re_test" });
    fetchMock.mockResolvedValue(new Response("domain not verified", { status: 403 }));
    const out = await send();
    expect(out.sent).toBe(false);
    expect(out.error).toMatch(/Resend 403/);
  });

  it("skips quietly with nothing configured", async () => {
    expect(await send()).toMatchObject({ sent: false, skipped: true });
  });
});
