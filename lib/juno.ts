import { normalizePhone } from "@/lib/applications";

/**
 * The college's JUNO Campus payment page.
 *
 * Why there is no prefilled link here: the portal serves an empty HTML shell
 * and builds its form at runtime from getRuntimeEventTempletsByEventID.json.
 * The only query parameter its script reads is eventID — there is no
 * name/email/phone parameter to hand it, and the inputs it renders carry no
 * `name` or `autocomplete` attribute either, so the browser's own autofill has
 * nothing to bind to. Prefilling it from our side is not possible without
 * changes on theirs, and those are not coming.
 *
 * So we do the next best thing and remove the retyping: the applicant already
 * gave us these four values, and we hand them back in the portal's own labels
 * and order, ready to copy.
 */
export const JUNO_EVENT_ID = 208;

export const JUNO_PAYMENT_URL =
  `https://ruasportal.msruas.ac.in/asd_EventPublicUserMaster.htm?eventID=${JUNO_EVENT_ID}`;

export type JunoField = { label: string; value: string };

export type JunoApplicant = {
  name: string;
  phone: string;
  email: string;
  /** People this payment covers — the lead plus anyone on their team. */
  heads: number;
};

const clean = (raw: unknown) => String(raw ?? "").trim().replace(/\s+/g, " ");

/**
 * The four boxes the portal actually asks for, in the order it asks for them.
 *
 * Labels are copied from the portal's own template rather than reworded: the
 * person reading this list has the portal open on their other screen, and a
 * label that does not match what they are looking at is one more thing to work
 * out mid-payment.
 */
export function junoFields(a: JunoApplicant): JunoField[] {
  return [
    { label: "NAME", value: clean(a.name) },
    /* Their field validates as alphanum and stores whatever it is given. A
       "+91 " prefix would survive into their export and stop matching the
       number we hold, so the prefix comes off before it ever gets there. */
    { label: "MOBILE NUMBER", value: normalizePhone(a.phone) },
    { label: "EMAIL ID", value: clean(a.email).toLowerCase() },
    { label: "NUMBER OF PARTICIPANT", value: String(Math.max(1, Math.trunc(a.heads) || 1)) },
  ];
}

/** Every field in one clipboard payload, for people who would rather paste
    from a list than press four buttons. */
export function junoFieldsText(a: JunoApplicant): string {
  return junoFields(a)
    .map((f) => `${f.label}: ${f.value}`)
    .join("\n");
}
