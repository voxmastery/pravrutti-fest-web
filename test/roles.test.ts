import { describe, it, expect } from "vitest";
import { events, eventId } from "@/lib/pravrutti-data";

describe("Event.dashboardEmails", () => {
  it("is optional and absent until the spreadsheet lands", () => {
    const e = events.find((x) => eventId(x.name) === "electroxcape")!;
    expect(e).toBeDefined();
    expect(e.dashboardEmails ?? []).toEqual([]);
  });
});
