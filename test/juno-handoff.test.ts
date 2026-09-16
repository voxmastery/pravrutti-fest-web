import { describe, it, expect } from "vitest";
import { JUNO_PAYMENT_URL } from "@/lib/juno";

describe("JUNO_PAYMENT_URL", () => {
  /* The portal builds its form from getRuntimeEventTempletsByEventID.json and
     reads exactly one query parameter — eventID. Drop it and the page renders
     an empty shell, so the id is not decoration. */
  it("carries the Pravrutti 2.0 event id", () => {
    expect(JUNO_PAYMENT_URL).toContain("eventID=208");
    expect(JUNO_PAYMENT_URL.startsWith("https://ruasportal.msruas.ac.in/")).toBe(true);
  });
});
