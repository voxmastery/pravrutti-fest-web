import { describe, it, expect } from "vitest";
import { roleForEmail } from "@/lib/roles";
import {
  emailFromSessionClaims,
  isPublicEventPath,
  isStaffAllowedPath,
  isStaffRole,
  staffCockpitRedirect,
  staffEmailFromCookieHeader,
} from "@/lib/staff-cockpit";
import { DEV_LOGIN_COOKIE } from "@/lib/dev-identity";

describe("isStaffRole", () => {
  it("treats organisers and coordinators as staff", () => {
    expect(isStaffRole("organiser")).toBe(true);
    expect(isStaffRole("coordinator")).toBe(true);
  });

  it("does not treat students or signed-out visitors as staff", () => {
    expect(isStaffRole("none")).toBe(false);
    expect(isStaffRole(undefined)).toBe(false);
    expect(isStaffRole(null)).toBe(false);
  });
});

describe("staffCockpitRedirect", () => {
  const marketing = [
    "/",
    "/about",
    "/faq",
    "/schedule",
    "/downloads",
    "/contact",
  ];

  const eventSurfaces = [
    "/events",
    "/events/",
    "/events/robo-climb",
  ];

  const keep = [
    "/dashboard",
    "/dashboard/applications",
    "/dashboard/scan",
    "/hacktivate/track",
    "/admin",
    "/admin/scan",
    "/faculty",
    "/ticket",
    "/tickets",
    "/sso-callback",
    "/api/register",
    "/api/dashboard/me",
    "/__clerk/handshake",
  ];

  it("sends an organiser away from public marketing pages", () => {
    for (const path of [...marketing, ...eventSurfaces]) {
      expect(staffCockpitRedirect(path, "organiser"), path).toBe("/dashboard");
    }
  });

  it("sends a coordinator away from the marketing home", () => {
    for (const path of marketing) {
      expect(staffCockpitRedirect(path, "coordinator"), path).toBe("/dashboard");
    }
  });

  it("lets a coordinator stay on the events listing and event pages", () => {
    for (const path of eventSurfaces) {
      expect(staffCockpitRedirect(path, "coordinator"), path).toBeNull();
    }
  });

  it("leaves organiser tools, tickets, and auth callbacks alone", () => {
    for (const path of keep) {
      expect(staffCockpitRedirect(path, "organiser"), path).toBeNull();
      expect(staffCockpitRedirect(path, "coordinator"), path).toBeNull();
    }
  });

  it("never traps a student or visitor on the cockpit", () => {
    for (const path of [...marketing, ...eventSurfaces, ...keep]) {
      expect(staffCockpitRedirect(path, "none"), path).toBeNull();
    }
  });

  it("leaves a student on a public event page they have not registered for", () => {
    expect(staffCockpitRedirect("/events/robo-climb", "none")).toBeNull();
    expect(staffCockpitRedirect("/events", "none")).toBeNull();
  });
});

describe("isStaffAllowedPath", () => {
  it("allows the cockpit and participant ticket surfaces", () => {
    expect(isStaffAllowedPath("/dashboard/applications")).toBe(true);
    expect(isStaffAllowedPath("/ticket")).toBe(true);
  });

  it("does not allow the public home or event listing", () => {
    expect(isStaffAllowedPath("/")).toBe(false);
    expect(isStaffAllowedPath("/events")).toBe(false);
    expect(isStaffAllowedPath("/events/robo-climb")).toBe(false);
  });
});

describe("isPublicEventPath", () => {
  it("matches the listing and a slug, not other marketing pages", () => {
    expect(isPublicEventPath("/events")).toBe(true);
    expect(isPublicEventPath("/events/")).toBe(true);
    expect(isPublicEventPath("/events/robo-race")).toBe(true);
    expect(isPublicEventPath("/")).toBe(false);
    expect(isPublicEventPath("/about")).toBe(false);
    expect(isPublicEventPath("/dashboard")).toBe(false);
  });
});

describe("staffCockpitRedirect from a resolved email", () => {
  it("redirects an ORGANISER_EMAILS address off the home page", () => {
    expect(staffCockpitRedirect("/", roleForEmail("boss@pravrutti.test").kind)).toBe(
      "/dashboard"
    );
  });

  it("redirects a coordinator listed on an event away from the marketing home", () => {
    expect(staffCockpitRedirect("/about", roleForEmail("arbharaath@gmail.com").kind)).toBe(
      "/dashboard"
    );
  });

  it("lets a listed coordinator open their public event page", () => {
    expect(
      staffCockpitRedirect("/events/robo-race", roleForEmail("arbharaath@gmail.com").kind)
    ).toBeNull();
  });

  it("leaves a regular student on the public site", () => {
    expect(staffCockpitRedirect("/", roleForEmail("student@college.edu").kind)).toBeNull();
  });

  it("leaves a missing email on the public site", () => {
    expect(staffCockpitRedirect("/", roleForEmail(null).kind)).toBeNull();
  });
});

describe("staffEmailFromCookieHeader", () => {
  it("reads the dev impersonation cookie", () => {
    expect(
      staffEmailFromCookieHeader(`${DEV_LOGIN_COOKIE}=boss@pravrutti.test`)
    ).toBe("boss@pravrutti.test");
  });

  it("returns null when the cookie is absent", () => {
    expect(staffEmailFromCookieHeader("other=1")).toBeNull();
  });
});

describe("emailFromSessionClaims", () => {
  it("picks a Clerk-style email claim", () => {
    expect(emailFromSessionClaims({ email: "Boss@Pravrutti.TEST" })).toBe(
      "boss@pravrutti.test"
    );
  });

  it("returns null when claims have no email", () => {
    expect(emailFromSessionClaims({ sub: "user_123" })).toBeNull();
    expect(emailFromSessionClaims(null)).toBeNull();
  });
});
