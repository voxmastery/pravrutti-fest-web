import { NextResponse } from "next/server";
import { applicationPath, readJsonByPath } from "@/lib/blob-store";
import { isLiveApplication, type Application } from "@/lib/applications";
import { DISCOVERIZE_EVENT_ID } from "@/lib/discoverize";
import { DISCOVERIZE_WHATSAPP_QR, DISCOVERIZE_WHATSAPP_URL } from "@/lib/discoverize-group";
import { resolveEmail } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Discoverize WhatsApp invite, for Discoverize teams and nobody else.
 *
 * An invite link is a credential: whoever holds it can walk into the group.
 * So it is not enough to hide a button — the string must never be sent to
 * someone who has not earned it, which is why it lives behind this endpoint
 * instead of in the page. Every refusal answers without the link anywhere in
 * the body.
 *
 * Earning it means one thing: a live registration for Discoverize under the
 * signed-in address. Registered for CHAOS and nothing else, signed in with no
 * registration at all, withdrawn, declined — all refused. Registered for
 * Discoverize *and* other events is still a Discoverize team, and gets it.
 *
 * The QR is the coordinators' own image, sent inline rather than served from
 * public/ — a file there is reachable by anyone who guesses its name, and a
 * photograph of the QR joins the group exactly as well as the link does.
 */
const deny = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers: { "cache-control": "no-store" } });

export async function GET() {
  const email = await resolveEmail();
  if (!email) return deny("Sign in to see your team's group.", 401);

  const app = (await readJsonByPath(
    applicationPath(DISCOVERIZE_EVENT_ID, email.toLowerCase()),
  )) as Application | null;

  /* Cancelled and declined are deliberately out: the group is for teams that
     are actually in the event. */
  if (!app || !isLiveApplication(app.status))
    return deny("This is for teams registered for Discoverize.", 403);

  return NextResponse.json(
    { url: DISCOVERIZE_WHATSAPP_URL, qr: DISCOVERIZE_WHATSAPP_QR },
    /* Per-person, so no shared cache may ever hold it. */
    { headers: { "cache-control": "private, no-store" } },
  );
}
