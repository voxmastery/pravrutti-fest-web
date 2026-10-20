import { NextResponse } from "next/server";
import { downloadCertificate } from "@/lib/certificate-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in person's own certificate. No name or email is taken from the query. */
export async function GET() {
  const result = await downloadCertificate();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status, headers: { "cache-control": "no-store" } },
    );
  }
  return new NextResponse(Buffer.from(result.pdf), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": result.disposition,
      "cache-control": "no-store",
    },
  });
}
