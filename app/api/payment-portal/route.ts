import { NextResponse } from "next/server";
import { JUNO_PAYMENT_URL } from "@/lib/juno";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Is the college's payment portal answering right now?
 *
 * It is not reliably up. It has served a 404 to the same URL that answered
 * normally minutes later, and students hit that 404 in the middle of paying —
 * some after their money had already moved. Checking first means the form can
 * say so before sending anyone, instead of handing them a Not Found page and
 * leaving them to guess whether they have been charged.
 *
 * Advisory, never a gate. A check that runs from our server can be wrong about
 * what a student's phone will see — a blocked IP, a network that resolves
 * differently — and refusing to let anyone pay on that basis would be a worse
 * failure than the one it prevents. The form warns and still lets them through.
 */

const TTL_MS = 30_000;
const TIMEOUT_MS = 8_000;

let cached: { ok: boolean; checkedAt: string; at: number } | null = null;

async function probe(): Promise<boolean> {
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(JUNO_PAYMENT_URL, {
      signal: control.signal,
      redirect: "follow",
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  /* Cached briefly: a queue of students opening the form together should not
     become a queue of requests against the college's server. */
  if (cached && Date.now() - cached.at < TTL_MS)
    return NextResponse.json(
      { ok: cached.ok, checkedAt: cached.checkedAt, cached: true },
      { headers: { "cache-control": "no-store" } },
    );

  const ok = await probe();
  cached = { ok, checkedAt: new Date().toISOString(), at: Date.now() };
  return NextResponse.json(
    { ok, checkedAt: cached.checkedAt, cached: false },
    { headers: { "cache-control": "no-store" } },
  );
}
