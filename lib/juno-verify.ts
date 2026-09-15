import "server-only";
import { JUNO_EVENT_ID } from "@/lib/juno";

/**
 * Path B — auto-verify a payment by asking Juno about a specific registration.
 *
 * The applicant pays on the Juno portal, which shows them "Successfully
 * Registered with ID <regId>", and pastes that id into our form. We then ask
 * Juno whether that registration is paid, keyed on the id the applicant gave
 * us — never by enumerating anyone else's.
 *
 * This file is split in two on purpose:
 *   - decideReconcile() is the PURE decision (paid? identity matches?), fully
 *     tested, so the rule that confirms a place is not tangled with network I/O.
 *   - checkJunoPayment() is the I/O adapter that will call Juno. It stays a
 *     conservative stub returning "unknown" until the one-regId spike confirms
 *     which endpoint reflects payment and what it returns — building a real
 *     fetch against an unconfirmed response shape would be guessing, and a
 *     wrong guess here confirms places that were never paid for.
 */

export type JunoPayState = "paid" | "unpaid" | "unknown";

export interface JunoPayCheck {
  state: JunoPayState;
  /** The name/email the portal returns for this reg id, when it returns any.
      Used only to bind the reg id to our applicant — see the spoof guard. */
  name?: string | null;
  email?: string | null;
}

export type ReconcileReason =
  | "paid"
  | "not-paid"
  | "unknown"
  | "no-reg-id"
  | "identity-mismatch";

export interface ReconcileDecision {
  confirm: boolean;
  reason: ReconcileReason;
}

const norm = (raw: unknown) => String(raw ?? "").trim().toLowerCase();

/**
 * Should this pending application be auto-confirmed, given what the portal
 * says about its reg id? Pure and side-effect free so the caller can pair it
 * with lib/payment-review.ts verifyPayment() once, in one place.
 */
export function decideReconcile(
  app: { email: string; junoRegId?: string | null },
  check: JunoPayCheck,
): ReconcileDecision {
  if (!app.junoRegId) return { confirm: false, reason: "no-reg-id" };
  if (check.state === "unknown") return { confirm: false, reason: "unknown" };
  if (check.state === "unpaid") return { confirm: false, reason: "not-paid" };

  // state === "paid": confirm, unless the portal hands back an identity that
  // contradicts the applicant. A blank identity is "no contradiction", not a
  // mismatch — some responses may not carry it.
  const portalEmail = norm(check.email);
  if (portalEmail && portalEmail !== norm(app.email))
    return { confirm: false, reason: "identity-mismatch" };

  return { confirm: true, reason: "paid" };
}

/**
 * Ask Juno whether a registration is paid.
 *
 * STUB until the spike. Returns "unknown" for every input so decideReconcile
 * never auto-confirms on a guess. When the college gives us one test reg id to
 * poll before/after a real ₹200 payment, we learn which endpoint flips and what
 * it returns, and implement this against those facts. The candidate endpoint is
 *   https://ruasportal.msruas.ac.in/sendEntryPassAndDownLoadPdf.json?eventRegId=<id>
 * for event ${JUNO_EVENT_ID}. Do not enable this on a hypothesis.
 */
export async function checkJunoPayment(regId: string): Promise<JunoPayCheck> {
  void regId;
  void JUNO_EVENT_ID;
  return { state: "unknown" };
}
