import "server-only";

/**
 * Discoverize's WhatsApp group.
 *
 * Server-only on purpose. An invite link in a client component is an invite
 * link in the JavaScript bundle, readable by anyone who opens devtools on a
 * page they were never registered for — which is exactly the thing this is
 * not allowed to be. Importing it from a client component is a build error
 * rather than a quiet leak, which is why `server-only` is at the top.
 *
 * The QR is rendered from the same string on the way out, so there is no
 * image file sitting in public/ to be found by guessing its name either.
 */
export const DISCOVERIZE_WHATSAPP_URL = "https://chat.whatsapp.com/JwYELEQfM1M2FlXEyh8UJ1";
