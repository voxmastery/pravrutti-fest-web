/**
 * A roster as a spreadsheet, for coordinators building their event's
 * WhatsApp group and call list instead of copying numbers off the screen.
 *
 * The rows are the people on screen, in the order they are shown — teams
 * together, lead first — so the file and the dashboard never disagree.
 * Withdrawn people are listed on screen but hold no place; they stay out.
 */

export const EXPORT_COLUMNS = ["Team", "Role", "Name", "Phone", "Email", "College", "Status", "Checked in"] as const;
export type ExportRow = Record<(typeof EXPORT_COLUMNS)[number], string>;

export type ExportPerson = {
  name: string;
  college: string;
  status: string;
  checkedInAt: string | null;
  team: string | null;
  role?: "lead" | "member" | null;
  email?: string;
  phone?: string;
  /** What the dashboard calls them: "Confirmed", "In review", … */
  stage: string;
};

const WITHDRAWN = new Set(["cancelled", "declined"]);

const arrived = (at: string | null) =>
  at
    ? new Date(at).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
      })
    : "";

export function exportRows(people: readonly ExportPerson[]): ExportRow[] {
  return people
    .filter((p) => !WITHDRAWN.has(p.status))
    .map((p) => ({
      Team: p.team ?? "Individual",
      Role: p.team === null ? "Solo" : p.role === "lead" ? "Lead" : "Member",
      Name: p.name,
      /* Text, always: handed a number, Excel shows 9.88E+09. */
      Phone: String(p.phone ?? ""),
      Email: p.email ?? "",
      College: p.college ?? "",
      Status: p.stage,
      "Checked in": arrived(p.checkedInAt),
    }));
}

export const exportFileName = (eventId: string, on: Date = new Date()) =>
  `${eventId}-participants-${on.toISOString().slice(0, 10)}.xlsx`;

/** Builds the workbook in the browser and hands it over as a download. The
    spreadsheet library is loaded only when someone presses the button. */
export async function downloadXlsx(rows: readonly ExportRow[], fileName: string) {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.json_to_sheet([...rows], { header: [...EXPORT_COLUMNS] });
  sheet["!cols"] = EXPORT_COLUMNS.map((c) => ({
    wch: Math.min(40, Math.max(c.length, ...rows.map((r) => r[c].length)) + 2),
  }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Participants");
  XLSX.writeFile(book, fileName);
}
