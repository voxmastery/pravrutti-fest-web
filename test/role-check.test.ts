import { describe, it, expect, beforeEach } from "vitest";
import { roleForEmail } from "@/lib/roles";

describe("voxmastery@gmail.com via the real Google path", () => {
  beforeEach(() => { process.env.ORGANISER_EMAILS = "voxmastery@gmail.com"; });

  it("resolves to organiser", () => {
    expect(roleForEmail("voxmastery@gmail.com")).toEqual({ kind: "organiser" });
  });
  it("is case-insensitive, as Google may return any casing", () => {
    expect(roleForEmail("VoxMastery@Gmail.com")).toEqual({ kind: "organiser" });
  });
  it("a coordinator address resolves to their own event only", () => {
    const r = roleForEmail("arbharaath@gmail.com");
    expect(r.kind).toBe("coordinator");
    if (r.kind === "coordinator") expect(r.eventIds).toContain("robo-race");
  });
  it("an unknown address gets nothing", () => {
    expect(roleForEmail("stranger@example.com")).toEqual({ kind: "none" });
  });
});
