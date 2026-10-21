import { readFileSync } from "fs";
import { inflateSync } from "zlib";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { decideCertificate, type CertificateFacts } from "@/lib/certificate-eligibility";
import {
  CERTIFICATE_QUESTIONS,
  parseCertificateAnswers,
} from "@/lib/certificate-questions";
import {
  NAME_LINE,
  TIMES_BOLD_DESCENT,
  certificateFileName,
  contentDisposition,
  descenderBottomPx,
  fitNameSize,
  nameBaselinePx,
  nameOriginX,
} from "@/lib/certificate-layout";
import { createMemoryFeedbackStore } from "@/lib/certificate-feedback";
import { renderCertificatePdf } from "@/lib/certificate-pdf";

const PROMPTS = [
  "How would you rate your overall experience at Pravrutti 2.0?",
  "How would you rate the events and activities?",
  "How was the overall organization and management?",
  "What did you enjoy the most at Pravrutti 2.0?",
  "What could we improve for the next edition?",
  "Would you love to be a part of the next Pravrutti?",
  "Share any additional feedback or suggestions.",
];

function facts(partial: Partial<CertificateFacts> & { email: string }): CertificateFacts {
  return {
    apps: [],
    memberships: [],
    teams: [],
    leadCheckedIn: [],
    ...partial,
  };
}

const validAnswers = {
  overall: "excellent",
  events: "good",
  organization: "average",
  enjoyed: "The robotics pit",
  next: "definitely",
};

describe("certificate questions", () => {
  it("keeps the seven prompts in one array, in order", () => {
    expect(CERTIFICATE_QUESTIONS.map((q) => q.prompt)).toEqual(PROMPTS);
    expect(CERTIFICATE_QUESTIONS.filter((q) => q.required).map((q) => q.id)).toEqual([
      "overall",
      "events",
      "organization",
      "enjoyed",
      "next",
    ]);
    const overall = CERTIFICATE_QUESTIONS[0];
    expect(overall.kind).toBe("choice");
    if (overall.kind === "choice") {
      expect(overall.options.map((o) => o.label)).toEqual([
        "⭐ Excellent",
        "😊 Good",
        "😐 Average",
        "🙁 Needs Improvement",
      ]);
    }
    const next = CERTIFICATE_QUESTIONS.find((q) => q.id === "next");
    expect(next?.kind).toBe("choice");
    if (next?.kind === "choice") {
      expect(next.options.map((o) => o.label)).toEqual(["Definitely!", "Maybe", "Not sure"]);
    }
  });

  it("accepts a complete form and ignores a name or email stuffed in beside it", () => {
    const parsed = parseCertificateAnswers({
      ...validAnswers,
      improve: "  Signage  ",
      comments: " Line one\nLine two ",
      name: "Someone Else",
      email: "other@example.com",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.answers).toEqual({
      ...validAnswers,
      improve: "Signage",
      comments: "Line one\nLine two",
    });
    expect(parsed.answers).not.toHaveProperty("name");
    expect(parsed.answers).not.toHaveProperty("email");
  });

  it("lets the two optional answers stay blank", () => {
    const parsed = parseCertificateAnswers(validAnswers);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.answers.improve).toBeUndefined();
    expect(parsed.answers.comments).toBeUndefined();
  });

  it("rejects a missing required choice and a bad option", () => {
    const missing = parseCertificateAnswers({ ...validAnswers, overall: "" });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toContain(PROMPTS[0]);

    const bogus = parseCertificateAnswers({ ...validAnswers, events: "superb" });
    expect(bogus.ok).toBe(false);
  });

  it("rejects an empty required short answer", () => {
    const parsed = parseCertificateAnswers({ ...validAnswers, enjoyed: "   " });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain(PROMPTS[3]);
  });
});

describe("certificate eligibility", () => {
  it("qualifies a person whose own ticket is checked in, under their registered name", () => {
    const decision = decideCertificate(
      facts({
        email: "Asha@Example.com",
        apps: [
          {
            eventId: "robo-race",
            email: "asha@example.com",
            name: "  Asha   Rao ",
            status: "confirmed",
            checkedInAt: "2026-10-14T04:00:00.000Z",
          },
        ],
      }),
    );
    expect(decision).toEqual({ eligible: true, name: "Asha Rao" });
  });

  it("hides the certificate when nobody on the ticket is checked in", () => {
    const decision = decideCertificate(
      facts({
        email: "asha@example.com",
        apps: [
          {
            eventId: "robo-race",
            email: "asha@example.com",
            name: "Asha Rao",
            status: "confirmed",
            checkedInAt: null,
          },
        ],
      }),
    );
    expect(decision.eligible).toBe(false);
  });

  it("qualifies a teammate when the lead is checked in, and prints the teammate's name", () => {
    const decision = decideCertificate(
      facts({
        email: "mate@example.com",
        apps: [
          {
            eventId: "robo-race",
            email: "mate@example.com",
            name: "Meera Nair",
            status: "confirmed",
            teamCode: "byteforge01",
            checkedInAt: null,
          },
        ],
        memberships: [
          { eventId: "robo-race", code: "BYTEFORGE01", name: "Meera Nair", removed: false },
        ],
        teams: [
          { eventId: "robo-race", code: "BYTEFORGE01", leadEmail: "Lead@Example.com", gone: false },
        ],
        leadCheckedIn: [{ eventId: "robo-race", email: "lead@example.com", checkedIn: true }],
      }),
    );
    expect(decision).toEqual({ eligible: true, name: "Meera Nair" });
  });

  it("qualifies a teammate when any confirmed member is checked in, under their own name", () => {
    const decision = decideCertificate(
      facts({
        email: "nithya@example.com",
        apps: [
          {
            eventId: "robo-race",
            email: "nithya@example.com",
            name: "Nithyashree G",
            status: "confirmed",
            teamCode: "BYTEFORGE01",
            checkedInAt: null,
          },
        ],
        memberships: [
          { eventId: "robo-race", code: "BYTEFORGE01", name: "Nithyashree G", removed: false },
        ],
        teams: [
          { eventId: "robo-race", code: "BYTEFORGE01", leadEmail: "lead@example.com", gone: false },
        ],
        leadCheckedIn: [
          { eventId: "robo-race", code: "BYTEFORGE01", email: "lead@example.com", checkedIn: false, status: "confirmed" },
          {
            eventId: "robo-race",
            code: "BYTEFORGE01",
            email: "parinitha@example.com",
            checkedIn: true,
            status: "confirmed",
          },
        ],
      }),
    );
    expect(decision).toEqual({ eligible: true, name: "Nithyashree G" });
  });

  it("ignores a cancelled, declined, removed, or other-team check-in", () => {
    const base = {
      email: "nithya@example.com",
      apps: [
        {
          eventId: "robo-race",
          email: "nithya@example.com",
          name: "Nithyashree G",
          status: "confirmed",
          teamCode: "BYTEFORGE01",
        },
      ],
      memberships: [
        { eventId: "robo-race", code: "BYTEFORGE01", name: "Nithyashree G", removed: false },
      ],
      teams: [
        { eventId: "robo-race", code: "BYTEFORGE01", leadEmail: "lead@example.com", gone: false },
      ],
    };
    for (const status of ["cancelled", "declined", "pending"]) {
      expect(
        decideCertificate(
          facts({
            ...base,
            leadCheckedIn: [
              {
                eventId: "robo-race",
                code: "BYTEFORGE01",
                email: "mate@example.com",
                checkedIn: true,
                status,
              },
            ],
          }),
        ).eligible,
      ).toBe(false);
    }
    expect(
      decideCertificate(
        facts({
          ...base,
          leadCheckedIn: [
            {
              eventId: "robo-race",
              code: "BYTEFORGE01",
              email: "mate@example.com",
              checkedIn: true,
              status: "confirmed",
              removed: true,
            },
          ],
        }),
      ).eligible,
    ).toBe(false);
    expect(
      decideCertificate(
        facts({
          ...base,
          leadCheckedIn: [
            {
              eventId: "robo-race",
              code: "OTHERTEAM001",
              email: "mate@example.com",
              checkedIn: true,
              status: "confirmed",
            },
          ],
        }),
      ).eligible,
    ).toBe(false);
  });

  it("does not qualify a teammate when the lead has not checked in", () => {
    const decision = decideCertificate(
      facts({
        email: "mate@example.com",
        apps: [
          {
            eventId: "robo-race",
            email: "mate@example.com",
            name: "Meera Nair",
            status: "confirmed",
            teamCode: "BYTEFORGE01",
          },
        ],
        memberships: [
          { eventId: "robo-race", code: "BYTEFORGE01", name: "Meera Nair", removed: false },
        ],
        teams: [
          { eventId: "robo-race", code: "BYTEFORGE01", leadEmail: "lead@example.com", gone: false },
        ],
        leadCheckedIn: [{ eventId: "robo-race", email: "lead@example.com", checkedIn: false }],
      }),
    );
    expect(decision.eligible).toBe(false);
  });

  it("ignores a removed teammate and a deleted team, even if the lead checked in", () => {
    const base = {
      email: "mate@example.com",
      apps: [
        {
          eventId: "robo-race",
          email: "mate@example.com",
          name: "Meera Nair",
          status: "cancelled",
          teamCode: "BYTEFORGE01",
        },
      ],
      teams: [
        { eventId: "robo-race", code: "BYTEFORGE01", leadEmail: "lead@example.com", gone: false },
      ],
      leadCheckedIn: [{ eventId: "robo-race", email: "lead@example.com", checkedIn: true }],
    };
    expect(
      decideCertificate(
        facts({
          ...base,
          memberships: [{ eventId: "robo-race", code: "BYTEFORGE01", name: "Meera Nair", removed: true }],
        }),
      ).eligible,
    ).toBe(false);
    expect(
      decideCertificate(
        facts({
          ...base,
          apps: [{ ...base.apps[0], status: "confirmed" }],
          memberships: [],
          teams: [{ ...base.teams[0], gone: true }],
        }),
      ).eligible,
    ).toBe(false);
  });

  it("does not treat a lead's check-in at a different event as this team's", () => {
    const decision = decideCertificate(
      facts({
        email: "mate@example.com",
        memberships: [
          { eventId: "robo-race", code: "BYTEFORGE01", name: "Meera Nair", removed: false },
        ],
        teams: [
          { eventId: "robo-race", code: "BYTEFORGE01", leadEmail: "lead@example.com", gone: false },
        ],
        leadCheckedIn: [{ eventId: "hacktivate", email: "lead@example.com", checkedIn: true }],
      }),
    );
    expect(decision.eligible).toBe(false);
  });

  it("never takes a name off someone else's application", () => {
    const decision = decideCertificate(
      facts({
        email: "mate@example.com",
        apps: [
          {
            eventId: "robo-race",
            email: "lead@example.com",
            name: "Lead Person",
            status: "confirmed",
            checkedInAt: "2026-10-14T04:00:00.000Z",
          },
        ],
      }),
    );
    expect(decision.eligible).toBe(false);
  });

  it("keeps a checked-in participant's own name when the team roster spells it differently", () => {
    const decision = decideCertificate(
      facts({
        email: "mate@example.com",
        apps: [
          {
            eventId: "robo-race",
            email: "mate@example.com",
            name: "Meera Nair",
            status: "confirmed",
            teamCode: "BYTEFORGE01",
            checkedInAt: "2026-10-14T05:00:00.000Z",
          },
        ],
        memberships: [
          { eventId: "robo-race", code: "BYTEFORGE01", name: "Meera N.", removed: false },
        ],
        teams: [
          { eventId: "robo-race", code: "BYTEFORGE01", leadEmail: "lead@example.com", gone: false },
        ],
        leadCheckedIn: [{ eventId: "robo-race", email: "lead@example.com", checkedIn: true }],
      }),
    );
    expect(decision).toEqual({ eligible: true, name: "Meera Nair" });
  });
});

describe("certificate layout", () => {
  it("sets the baseline so a descender clears the diamond", () => {
    const bottom = descenderBottomPx(NAME_LINE.preferredSize);
    expect(bottom).toBeLessThanOrEqual(NAME_LINE.diamondTop - NAME_LINE.diamondGap);
    expect(nameBaselinePx()).toBeLessThan(NAME_LINE.diamondTop);
    expect(descenderBottomPx(NAME_LINE.minSize)).toBeLessThan(bottom);
    expect(TIMES_BOLD_DESCENT).toBeGreaterThan(0.2);
  });

  it("shrinks a long name and leaves a short one at the preferred size", () => {
    expect(fitNameSize(() => 100)).toBe(NAME_LINE.preferredSize);
    const wide = fitNameSize((size) => size * 40);
    expect(wide).toBeLessThan(NAME_LINE.preferredSize);
    expect(wide).toBeGreaterThanOrEqual(NAME_LINE.minSize);
    expect(nameOriginX(200)).toBe(NAME_LINE.centerX - 100);
  });

  it("names the download Pravrutti2.0_Certificate_<Name>", () => {
    expect(certificateFileName("Jaydeep Gregory")).toBe("Pravrutti2.0_Certificate_Jaydeep_Gregory.pdf");
    expect(contentDisposition("Pravrutti2.0_Certificate_Jaydeep_Gregory.pdf")).toContain(
      'filename="Pravrutti2.0_Certificate_Jaydeep_Gregory.pdf"',
    );
  });
});

describe("certificate feedback store", () => {
  it("keeps the first row and does not overwrite it", async () => {
    const store = createMemoryFeedbackStore();
    const first = await store.insertOnce({
      email: "Asha@Example.com",
      name: "Asha Rao",
      answers: { overall: "excellent" },
      submittedAt: "2026-10-16T10:00:00.000Z",
    });
    expect(first.created).toBe(true);
    const second = await store.insertOnce({
      email: "asha@example.com",
      name: "Someone Else",
      answers: { overall: "average" },
      submittedAt: "2026-10-16T12:00:00.000Z",
    });
    expect(second.created).toBe(false);
    expect(second.row.answers).toEqual({ overall: "excellent" });
    expect(second.row.name).toBe("Asha Rao");
    expect(await store.list()).toHaveLength(1);
  });
});

describe("certificate pdf", () => {
  it("draws a checked-in name in maroon Times-Bold on an A4 landscape page", async () => {
    const { pdf, filename } = await renderCertificatePdf("Jaydeep Gregory");
    expect(filename).toBe("Pravrutti2.0_Certificate_Jaydeep_Gregory.pdf");
    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getSize()).toEqual({ width: 841.89, height: 595.28 });
    const text = inflatePdf(Buffer.from(pdf));
    expect(text).toContain("<4A61796465657020477265676F7279> Tj");
    expect(text).toContain("/Times-Bold");
    expect(text).toMatch(/0\.43137\d* 0\.07843\d* 0\.19607\d* rg/);
  });

  it("still renders a long name", async () => {
    const long = "Alexandria Montgomery-Featherstone of Ramaiah University";
    const { pdf, filename } = await renderCertificatePdf(long);
    expect(filename.startsWith("Pravrutti2.0_Certificate_")).toBe(true);
    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
  });
});

function inflatePdf(buf: Buffer): string {
  const raw = buf.toString("latin1");
  const parts = [raw];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) {
    try {
      parts.push(inflateSync(Buffer.from(match[1], "latin1")).toString("latin1"));
    } catch {
      /* Image streams and object streams are not the text we are checking. */
    }
  }
  return parts.join("\n");
}

describe("certificate writes", () => {
  const read = (file: string) => readFileSync(file, "utf8");

  it("does not mail anyone or write tickets, check-ins, or teams", () => {
    const files = [
      "lib/certificate-service.ts",
      "lib/certificate-feedback.ts",
      "lib/certificate-pdf.ts",
      "app/api/certificate/route.ts",
      "app/api/certificate/download/route.ts",
    ].map(read);
    const joined = files.join("\n");
    expect(joined).not.toMatch(/putJson|casUpdate|deleteJson|nodemailer|sendMail|mailer/);
    expect(read("lib/certificate-feedback.ts")).not.toMatch(/\bUPDATE\b/);
    expect(read("lib/certificate-feedback.ts")).toContain("INSERT IGNORE");
    expect(read("app/api/certificate/route.ts")).not.toMatch(/body\.email|body\.name|searchParams/);
    expect(read("app/api/certificate/download/route.ts")).not.toMatch(/searchParams|req\.url/);
    expect(read("lib/certificate-service.ts")).toContain("resolveEmail");
    expect(read("lib/certificate-service.ts")).toContain("listTeamMembers");
    expect(read("lib/certificate-service.ts")).toContain('app?.status === "confirmed"');
    const actions = read("components/certificate-actions.tsx");
    expect(actions).toContain("Couldn&apos;t check your certificate status");
    expect(actions).toMatch(/>\s*Retry\s*</);
    expect(actions).toContain("setAttempt((n) => n + 1)");
  });
});
