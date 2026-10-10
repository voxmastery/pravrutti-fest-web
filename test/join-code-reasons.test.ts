import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { cleanPersonName, personNameError, teamFullJoinMessage } from "@/lib/teams";

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

describe("why a code join did not go through", () => {
  it("names the team that has no free slot", () => {
    expect(teamFullJoinMessage({ name: "CODE RED", memberCount: 4, maxMembers: 4 }))
      .toBe("CODE RED is full (4/4). Ask the lead to free a slot.");
  });

  it("collapses a name the same way the server will", () => {
    expect(cleanPersonName("  Ann   a  ")).toBe("Ann a");
    expect(personNameError("A")).toBe("Enter a name (2–80 characters).");
    expect(personNameError("A".repeat(81))).toBe("Enter a name (2–80 characters).");
    expect(personNameError("Ann")).toBeNull();
  });

  it("hides the public join link once the event is full", () => {
    const panel = read("../components/event-register-panel.tsx");
    expect(panel).toContain("{event.name} is full. Joining with a team code is closed.");
    expect(panel).not.toContain("Join it with your team code");
  });

  it("shows that sentence on the verified team, where the button used to just sit disabled", () => {
    const dialog = read("../components/registration-dialog.tsx");
    expect(dialog).toContain("teamFullJoinMessage(verifiedTeam)");
    expect(dialog).toContain("verifiedTeam.isFull && !verifiedTeam.invited");
  });
});
