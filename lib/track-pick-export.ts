import { formatPickTime, trackById } from "@/lib/track-pick";

export type TrackExportSource = {
  teamCode: string;
  teamName: string;
  leadName: string;
  leadEmail: string;
  leadPhone: string;
  status: string;
  trackId: string | null;
  seat: number | null;
  pickedAt: string | null;
};

export const TRACK_EXPORT_COLUMNS = [
  "Team ID",
  "Team",
  "Lead",
  "Phone",
  "Email",
  "Track",
  "Seat",
  "Picked at (IST)",
  "Status",
] as const;

export type TrackExportRow = Record<(typeof TRACK_EXPORT_COLUMNS)[number], string>;

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  in_review: "In review",
  closed: "Closed",
  other: "Other",
};

export function trackPickExportRows(rows: readonly TrackExportSource[]): TrackExportRow[] {
  return rows.map((r) => {
    const track = r.trackId ? trackById(r.trackId) : null;
    return {
      "Team ID": r.teamCode,
      Team: r.teamName,
      Lead: r.leadName,
      Phone: r.leadPhone,
      Email: r.leadEmail,
      Track: track ? `T${Number(track.id)} · ${track.title}` : "Not picked",
      Seat: r.seat ? String(r.seat) : "",
      "Picked at (IST)": r.pickedAt ? formatPickTime(r.pickedAt) : "",
      Status: STATUS_LABEL[r.status] ?? r.status,
    };
  });
}

function csvCell(value: string): string {
  /* A leading tab keeps Excel from turning a phone number into scientific notation. */
  const text = value;
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function trackPickCsv(rows: readonly TrackExportRow[]): string {
  const lines = [TRACK_EXPORT_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(TRACK_EXPORT_COLUMNS.map((c) => csvCell(c === "Phone" ? `\t${row[c]}` : row[c])).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

/** Browser download. The spreadsheet library is loaded only when someone exports. */
export async function downloadTrackWorkbook(rows: readonly TrackExportRow[], fileName: string) {
  const XLSX = await import("xlsx");
  const header = [...TRACK_EXPORT_COLUMNS];
  const sheet = XLSX.utils.aoa_to_sheet([
    header,
    ...rows.map((row) => header.map((c) => row[c])),
  ]);
  /* Force every cell to text so phone numbers stay phone numbers. */
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1");
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      if (cell) cell.t = "s";
    }
  }
  sheet["!cols"] = header.map((c) => ({
    wch: Math.min(42, Math.max(c.length, ...rows.map((row) => row[c].length)) + 2),
  }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Track picks");
  XLSX.writeFile(book, fileName);
}

export function downloadTrackCsv(csv: string, fileName: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
