import { FEST } from "@/lib/pravrutti-data";
import { sendMail, siteOrigin, type SendResult } from "@/lib/mailer";
import { PALETTE } from "@/lib/palette";
import { inviteSubject } from "@/lib/invites";

/**
 * The invitation a team lead's added member receives.
 *
 * It has to answer, in the first two lines, the question every one of these
 * emails raises: who is this and why am I in their team? So it leads with the
 * lead's name, the team name and the event — not with branding.
 *
 * The link is the only credential: clicking it confirms the member, which is
 * why it is a plain button and not a code to type. Nothing here asks the
 * member to pay: their lead has covered the team.
 */

function firstName(full: string) {
  const first = String(full ?? "").trim().split(/\s+/)[0] ?? "";
  return first || "there";
}

const BRAND = {
  ink: PALETTE.midnightNavy,
  panel: PALETTE.cosmicPurple,
  line: PALETTE.royalWine,
  cream: PALETTE.pearlWhite,
  gold: PALETTE.champagneGold,
  pink: PALETTE.cyberPink,
};

export type InviteMail = {
  to: string;
  memberName: string;
  leadName: string;
  teamName: string;
  eventName: string;
  token: string;
};

export function inviteUrl(token: string) {
  return `${siteOrigin()}/invite/${token}`;
}

function rowsFor(m: InviteMail): [string, string][] {
  return [
    ["Event", m.eventName],
    ["Team", m.teamName],
    ["Team lead", m.leadName],
    ["Dates", FEST.dates],
    ["Venue", FEST.venue],
  ];
}

function html(m: InviteMail, url: string) {
  const cells = rowsFor(m)
    .map(
      ([k, v]) => `
        <tr>
          <td style="padding:8px 0;color:rgba(247,238,228,.55);font-size:13px;">${k}</td>
          <td style="padding:8px 0;color:${BRAND.cream};font-size:13px;font-weight:600;text-align:right;">${v}</td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:${BRAND.ink};font-family:Segoe UI,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
    <tr><td style="padding-bottom:8px;color:${BRAND.pink};font-size:12px;letter-spacing:.22em;text-transform:uppercase;font-weight:700;">
      ${FEST.name}
    </td></tr>
    <tr><td style="background:${BRAND.panel};border:1px solid ${BRAND.line};border-radius:18px;padding:28px;">
      <h1 style="margin:0 0 10px;color:${BRAND.gold};font-size:22px;">
        ${m.leadName} added you to ${m.teamName}
      </h1>
      <p style="margin:0 0 18px;color:rgba(247,238,228,.75);font-size:14px;line-height:1.6;">
        Hi ${firstName(m.memberName)} — you have been added to the team
        <strong style="color:${BRAND.cream};">${m.teamName}</strong> for
        <strong style="color:${BRAND.cream};">${m.eventName}</strong> at ${FEST.name}.
        Accept below to confirm your place and see your team.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="border-top:1px solid ${BRAND.line};border-bottom:1px solid ${BRAND.line};margin-bottom:22px;">
        ${cells}
      </table>

      <a href="${url}"
         style="display:block;background:${BRAND.pink};color:#fff;text-decoration:none;text-align:center;
                padding:14px;border-radius:12px;font-weight:700;font-size:14px;">
        Accept and see my team
      </a>

      <p style="margin:18px 0 0;color:rgba(247,238,228,.5);font-size:12px;line-height:1.6;">
        There is nothing to pay — ${m.leadName} has covered the team's entry.
        If you did not expect this, you can leave the team from the same page,
        and nobody will be able to add you back with this link.
      </p>
    </td></tr>
    <tr><td style="padding-top:14px;color:rgba(247,238,228,.35);font-size:11px;text-align:center;">
      ${FEST.venue}
    </td></tr>
  </table>
</body></html>`;
}

function text(m: InviteMail, url: string) {
  return [
    `${m.leadName} added you to ${m.teamName}.`,
    ``,
    `Hi ${firstName(m.memberName)} — you have been added to the team ${m.teamName}`,
    `for ${m.eventName} at ${FEST.name}. Accept to confirm your place and see your team.`,
    ``,
    ...rowsFor(m).map(([k, v]) => `${k}: ${v}`),
    ``,
    `Accept: ${url}`,
    ``,
    `There is nothing to pay — ${m.leadName} has covered the team's entry. If you did`,
    `not expect this, you can leave the team from the same page.`,
    ``,
    `${FEST.name} — ${FEST.venue}`,
  ].join("\n");
}

/** Never throws: a failed invite must not undo the member the lead just added.
    The lead can still hand over the link themselves — the dialog shows it. */
export async function sendInviteEmail(m: InviteMail): Promise<SendResult> {
  const url = inviteUrl(m.token);
  try {
    return await sendMail({
      to: m.to,
      subject: inviteSubject({ eventName: m.eventName, teamName: m.teamName }),
      html: html(m, url),
      text: text(m, url),
    });
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "Mail send failed." };
  }
}
