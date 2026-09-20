import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { putJson } from "@/lib/blob-store";
import { markAbstractSubmitted } from "@/lib/discoverize-review";
import { abstractWebhookToken, tokenMatches } from "@/lib/abstract-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Google Form telling us an abstract actually arrived.
 *
 * A button click on our side proves only that somebody opened the form, which
 * is why the ticket does not change state until this fires: the submission is
 * recorded by the thing that received it. An Apps Script bound to the form's
 * response sheet calls this once per submission, signed with the token in
 * lib/abstract-webhook.
 *
 * An address we do not recognise is kept rather than dropped — somebody
 * filling the form from a different mailbox is a real case, and a coordinator
 * can match it by hand. Always answers 200 in that case so Apps Script does
 * not sit in a retry loop over a problem retrying cannot fix.
 */
export async function POST(req: Request) {
  const expected = abstractWebhookToken();
  if (!expected)
    return NextResponse.json({ error: "Abstract webhook is not configured." }, { status: 503 });
  if (!tokenMatches(req.headers.get("x-abstract-token"), expected))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
    return NextResponse.json({ error: "No usable email address in that submission." }, { status: 400 });

  const at = typeof body?.submittedAt === "string" && !Number.isNaN(Date.parse(body.submittedAt))
    ? new Date(body.submittedAt).toISOString()
    : new Date().toISOString();

  const out = await markAbstractSubmitted({ email, source: "form", at });
  if (out) return NextResponse.json({ ok: true, matched: true, marked: out.applications.length });

  /* Keyed by address so a resubmission overwrites rather than piles up. */
  const key = createHash("sha256").update(email).digest("hex").slice(0, 24);
  try {
    await putJson(`abstract-unmatched/${key}.json`, {
      email,
      name: String(body?.name ?? "").slice(0, 120) || null,
      title: String(body?.title ?? "").slice(0, 200) || null,
      receivedAt: at,
    }, true);
  } catch (e) {
    console.error("unmatched abstract store failed", e);
  }
  return NextResponse.json({ ok: true, matched: false });
}
