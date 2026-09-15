import { describe, it, expect } from "vitest";
import { JUNO_PAYMENT_URL, junoFields, junoFieldsText } from "@/lib/juno";

const base = { name: "Asha Rao", phone: "9876543210", email: "asha@example.com", heads: 3 };

describe("JUNO_PAYMENT_URL", () => {
  /* The portal builds its form from getRuntimeEventTempletsByEventID.json and
     reads exactly one query parameter — eventID. Drop it and the page renders
     an empty shell, so the id is not decoration. */
  it("carries the Pravrutti 2.0 event id", () => {
    expect(JUNO_PAYMENT_URL).toContain("eventID=208");
    expect(JUNO_PAYMENT_URL.startsWith("https://ruasportal.msruas.ac.in/")).toBe(true);
  });
});

describe("junoFields", () => {
  /* The labels are the portal's own, in the portal's order. Someone copying
     from our page is looking at their screen, not at us: a field we call
     "Phone" next to a box labelled "MOBILE NUMBER" is one more thing for them
     to resolve while their payment session is open. */
  it("names and orders the fields exactly as the portal does", () => {
    expect(junoFields(base).map((f) => f.label)).toEqual([
      "NAME",
      "MOBILE NUMBER",
      "EMAIL ID",
      "NUMBER OF PARTICIPANT",
    ]);
  });

  it("carries the applicant's own values through", () => {
    const byLabel = Object.fromEntries(junoFields(base).map((f) => [f.label, f.value]));
    expect(byLabel["NAME"]).toBe("Asha Rao");
    expect(byLabel["MOBILE NUMBER"]).toBe("9876543210");
    expect(byLabel["EMAIL ID"]).toBe("asha@example.com");
    expect(byLabel["NUMBER OF PARTICIPANT"]).toBe("3");
  });

  /* Our own field accepts "+91 98765 43210" and stores it normalised; the
     portal validates as alphanum and will take the prefix straight into the
     record, where it stops matching the number on our side at reconciliation. */
  it("hands over a bare ten-digit mobile number", () => {
    expect(junoFields({ ...base, phone: "+91 98765 43210" })[1].value).toBe("9876543210");
  });

  /* A solo entry is one participant, not zero. */
  it("never offers a head count below one", () => {
    expect(junoFields({ ...base, heads: 0 })[3].value).toBe("1");
    expect(junoFields({ ...base, heads: -4 })[3].value).toBe("1");
  });

  it("trims stray whitespace rather than pasting it into the portal", () => {
    expect(junoFields({ ...base, name: "  Asha Rao  " })[0].value).toBe("Asha Rao");
    expect(junoFields({ ...base, email: " ASHA@example.com " })[2].value).toBe("asha@example.com");
  });
});

describe("junoFieldsText", () => {
  /* One tap for people who would rather have all four in the clipboard and
     paste them one at a time than press four separate buttons. */
  it("lists every field as label and value, one per line", () => {
    expect(junoFieldsText(base)).toBe(
      ["NAME: Asha Rao", "MOBILE NUMBER: 9876543210", "EMAIL ID: asha@example.com", "NUMBER OF PARTICIPANT: 3"].join("\n"),
    );
  });
});
