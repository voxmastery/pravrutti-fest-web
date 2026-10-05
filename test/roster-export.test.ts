import { describe, it, expect } from "vitest";
import { exportRows, exportFileName, EXPORT_COLUMNS } from "@/lib/roster-export";

/**
 * A coordinator's roster, as a spreadsheet.
 *
 * Coordinators were copying names and numbers off the dashboard by hand to
 * build their event's WhatsApp group and call list. The export is the list
 * they are looking at — the same people, in the same team order, lead
 * first — with every contact field written out. Withdrawn people are on
 * screen but hold no place, so they stay out of the file.
 */

const person = (over: Record<string, unknown> = {}) => ({
  name: "Asha", college: "RUAS", status: "confirmed", checkedInAt: null,
  team: null, role: null, email: "asha@example.com", phone: "9876543210",
  stage: "Confirmed", ...over,
}) as never;

describe("exportRows", () => {
  it("writes one row per person, with every contact field", () => {
    const [row] = exportRows([person()]);
    expect(row).toEqual({
      Team: "Individual", Role: "Solo", Name: "Asha", Phone: "9876543210",
      Email: "asha@example.com", College: "RUAS", Status: "Confirmed", "Checked in": "",
    });
  });

  it("uses the columns in the order a call list wants them", () => {
    expect(Object.keys(exportRows([person()])[0])).toEqual([...EXPORT_COLUMNS]);
    expect(EXPORT_COLUMNS.slice(0, 4)).toEqual(["Team", "Role", "Name", "Phone"]);
  });

  /* Excel turns a long digit string into 9.88E+09 if it is handed a number. */
  it("keeps the phone number as text", () => {
    expect(typeof exportRows([person()])[0].Phone).toBe("string");
  });

  it("names the team and who leads it", () => {
    const rows = exportRows([
      person({ name: "Lead", team: "KIRA", role: "lead" }),
      person({ name: "Mate", team: "KIRA", role: "member" }),
    ]);
    expect(rows.map((r) => [r.Team, r.Role, r.Name])).toEqual([["KIRA", "Lead", "Lead"], ["KIRA", "Member", "Mate"]]);
  });

  it("keeps the order it is given — the order on screen", () => {
    const rows = exportRows([person({ name: "Zed" }), person({ name: "Amy" })]);
    expect(rows.map((r) => r.Name)).toEqual(["Zed", "Amy"]);
  });

  it("leaves out people who withdrew or were turned down", () => {
    const rows = exportRows([
      person({ name: "In" }),
      person({ name: "Left", status: "cancelled" }),
      person({ name: "Declined", status: "declined" }),
    ]);
    expect(rows.map((r) => r.Name)).toEqual(["In"]);
  });

  it("writes the check-in time once someone has arrived", () => {
    const [row] = exportRows([person({ checkedInAt: "2026-10-14T04:05:00.000Z" })]);
    expect(row["Checked in"]).toMatch(/14 Oct/);
  });

  it("leaves a blank, not 'undefined', where a field is missing", () => {
    const [row] = exportRows([person({ email: undefined, phone: undefined, college: "" })]);
    expect(row.Email).toBe("");
    expect(row.Phone).toBe("");
  });
});

describe("exportFileName", () => {
  it("names the event and the day", () => {
    expect(exportFileName("line-follower", new Date("2026-10-04T10:00:00Z"))).toBe("line-follower-participants-2026-10-04.xlsx");
  });
});
