import { describe, it, expect } from "vitest";
import { devImpersonatedEmail } from "@/lib/dev-identity";

/**
 * The override bypasses sign-in, so the only test that really matters is the
 * one proving it cannot do so on a deployed build. Everything else is comfort.
 */
describe("devImpersonatedEmail", () => {
  it("is inert in production even when the variable is set", () => {
    expect(
      devImpersonatedEmail({ NODE_ENV: "production", email: "someone@example.com" })
    ).toBeNull();
  });

  it("is inert in development when the variable is unset", () => {
    expect(devImpersonatedEmail({ NODE_ENV: "development", email: undefined })).toBeNull();
    expect(devImpersonatedEmail({ NODE_ENV: "development", email: "" })).toBeNull();
    expect(devImpersonatedEmail({ NODE_ENV: "development", email: "   " })).toBeNull();
  });

  it("returns the address only when both conditions hold", () => {
    expect(
      devImpersonatedEmail({ NODE_ENV: "development", email: "Dev@Example.com" })
    ).toBe("dev@example.com");
  });

  it("normalises like roleForEmail does, so the role actually matches", () => {
    // roles.ts lowercases and trims before comparing; if this drifted, the
    // override would sign you in as an address that matches no role at all.
    expect(
      devImpersonatedEmail({ NODE_ENV: "test", email: "  ORGANISER@Example.COM  " })
    ).toBe("organiser@example.com");
  });
});
