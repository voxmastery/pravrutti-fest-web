import { describe, it, expect } from "vitest";
import { nativeQrSupported } from "@/lib/qr-scanner";

describe("qr-scanner", () => {
  it("reports no native BarcodeDetector under Node (desk falls back to ZXing)", () => {
    expect(nativeQrSupported()).toBe(false);
  });
});
