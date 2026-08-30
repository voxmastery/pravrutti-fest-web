import { describe, it, expect } from "vitest";
import { eventId } from "@/lib/pravrutti-data";

describe("test harness", () => {
  it("resolves the @ alias into lib", () => {
    expect(eventId("Robo Climb")).toBe("robo-climb");
  });
});
