/**
 * The college's JUNO Campus payment page.
 *
 * Why there is no prefilled link here: the portal serves an empty HTML shell
 * and builds its form at runtime from getRuntimeEventTempletsByEventID.json.
 * The only query parameter its script reads is eventID — there is no
 * name/email/phone parameter to hand it, and the inputs it renders carry no
 * `name` or `autocomplete` attribute either, so the browser's own autofill has
 * nothing to bind to. Prefilling it from our side is not possible without
 * changes on theirs.
 *
 * So the dialog sends people straight there and says only the one thing that is
 * easy to get wrong: the participant count, which the portal fixes at payment
 * and will not let anyone raise once teammates join later.
 */
export const JUNO_EVENT_ID = 208;

export const JUNO_PAYMENT_URL =
  `https://ruasportal.msruas.ac.in/asd_EventPublicUserMaster.htm?eventID=${JUNO_EVENT_ID}`;
