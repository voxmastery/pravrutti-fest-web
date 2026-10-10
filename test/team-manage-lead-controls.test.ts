import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { TeamManage } from "@/components/team-manage";
import type { TeamPreview } from "@/lib/teams";

/**
 * Remove and Make lead on My Tickets.
 *
 * Both used to sit behind a muted "Manage team" link. Add a member did not,
 * so a lead looking at the roster — and the coordinator on the phone with
 * them — concluded there was no way to remove someone or change the lead.
 * The controls are in the first render, labeled, with no disclosure to open.
 * Make lead stays for a teammate who has joined. Add follows canInvite, so
 * a closed window hides it only when the server says the team cannot grow.
 */

function team(over: Partial<TeamPreview> = {}): TeamPreview {
  return {
    code: "MRGDYG2H3FCQ",
    name: "Code Riders",
    bio: "",
    memberCount: 3,
    maxMembers: 4,
    isFull: false,
    isLead: true,
    canInvite: true,
    leadEmail: "lead@example.com",
    members: [
      { name: "Rayhaan Backer Shah", email: "lead@example.com", status: "joined" },
      { name: "Prithvin Jothinathan", email: "prithvin@example.com", status: "joined" },
      { name: "Invited Pal", email: "invited@example.com", status: "invited" },
    ],
    ...over,
  };
}

function html(over: Partial<TeamPreview> = {}, canAdd = true, viewerEmail = "lead@example.com") {
  return renderToStaticMarkup(
    createElement(TeamManage, {
      eventId: "hacktivate",
      team: team(over),
      viewerEmail,
      leadName: "Rayhaan Backer Shah",
      canAdd,
      onChanged: () => {},
    }),
  );
}

/** The markup for one roster row, from that person's name to the next. */
function row(markup: string, name: string) {
  const at = markup.indexOf(name);
  expect(at, name).toBeGreaterThan(-1);
  return markup.slice(at, markup.indexOf("</li>", at));
}

describe("lead controls on the ticket", () => {
  it("shows Remove and Make lead without a Manage team disclosure", () => {
    const markup = html();
    expect(markup).not.toContain("Manage team");
    expect(markup).toContain("Remove or change lead");
    const joined = row(markup, "Prithvin Jothinathan");
    expect(joined).toMatch(/Make lead\s*<\/button>/);
    expect(joined).toMatch(/Remove\s*<\/button>/);
    expect(joined).toContain("Edit name for Prithvin Jothinathan");
    expect(markup).toContain("Edit name for Rayhaan Backer Shah");
    const invited = row(markup, "Invited Pal");
    expect(invited).not.toContain("Make lead");
    expect(invited).toMatch(/Remove\s*<\/button>/);
  });

  it("shows Add a member when the server says this team can still grow", () => {
    expect(html({ canInvite: true })).toContain("Add a member");
  });

  it("keeps Add visible but disabled when the server would refuse, and hides it when this registration is not live", () => {
    const closed = html({ canInvite: false, inviteBlockedReason: "Registration closed on 11:59 PM, 01 OCT 2026. New members can't be added." });
    expect(closed).toContain("Add a member");
    expect(closed).toContain("Registration closed on 11:59 PM, 01 OCT 2026");
    expect(closed).toContain("disabled");
    expect(html({ canInvite: true }, false)).not.toContain("Add a member");
    /* Remove stays. A closed window is not what hides it. */
    expect(closed).toMatch(/Remove\s*<\/button>/);
    expect(closed).toMatch(/Make lead\s*<\/button>/);
  });

  it("shows a full roster as full, rather than as an open invite", () => {
    expect(html({ canInvite: true, isFull: true })).toContain("Team is full");
    expect(html({ canInvite: true, isFull: true })).not.toContain("Add a member");
  });

  it("lets a member edit only their own name", () => {
    const markup = html({ isLead: false });
    expect(markup).toContain("Your name");
    expect(markup).toContain("Edit name for Rayhaan Backer Shah");
    expect(markup).not.toContain("Prithvin");
    expect(markup).not.toContain("Remove");
    expect(markup).not.toContain("Make lead");
    expect(markup).not.toContain("Delete this team");
    expect(markup).not.toContain("Add a member");
  });

  it("draws nothing for someone who is not on the roster", () => {
    expect(html({ isLead: false }, true, "stranger@example.com")).toBe("");
  });
});
