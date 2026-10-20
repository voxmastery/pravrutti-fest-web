import { NextResponse } from "next/server";
import { certificateFeedbackExport } from "@/lib/certificate-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const format = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "json";
  const result = await certificateFeedbackExport(format);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status, headers: { "cache-control": "no-store" } },
    );
  }
  if (result.format === "csv") {
    return new NextResponse(result.body, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": result.disposition,
        "cache-control": "no-store",
      },
    });
  }
  return NextResponse.json(
    { rows: result.rows },
    { headers: { "cache-control": "no-store" } },
  );
}
