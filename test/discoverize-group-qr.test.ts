import { describe, it, expect } from "vitest";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { DISCOVERIZE_WHATSAPP_QR, DISCOVERIZE_WHATSAPP_URL } from "@/lib/discoverize-group";

/**
 * The QR and the link must point at the same group.
 *
 * They are two separate constants, and a QR is opaque to a reader — nobody
 * reviewing a diff can tell that a pasted image still encodes the right
 * invite. If the group is ever recreated and only one of the two is updated,
 * half the teams would scan their way into a group nobody is watching, and
 * the mistake would be invisible until somebody complained. So the image is
 * actually decoded here and checked against the link.
 */
describe("the Discoverize WhatsApp QR", () => {
  const decoded = (() => {
    const b64 = DISCOVERIZE_WHATSAPP_QR.replace(/^data:image\/png;base64,/, "");
    const png = PNG.sync.read(Buffer.from(b64, "base64"));
    return jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  })();

  it("is a readable QR code at all", () => {
    expect(decoded).not.toBeNull();
  });

  it("encodes exactly the invite link we hand out beside it", () => {
    expect(decoded?.data).toBe(DISCOVERIZE_WHATSAPP_URL);
  });

  it("is a png data URL, so it can be dropped straight into an <img>", () => {
    expect(DISCOVERIZE_WHATSAPP_QR.startsWith("data:image/png;base64,")).toBe(true);
  });

  /* Inlined, so it rides in every response that carries it. Big enough to
     scan off a screen, small enough not to matter. */
  it("stays small enough to inline", () => {
    expect(DISCOVERIZE_WHATSAPP_QR.length).toBeLessThan(60_000);
  });
});
