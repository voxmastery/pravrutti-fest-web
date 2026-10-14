import { describe, expect, it } from "vitest";
import {
  ARDUINO_IDE_INSTALL_URL,
  ARDUINO_IDE_PCBCUPID_SETUP_URL,
  PCB_CUPID_HACKTIVATE_URL,
} from "@/lib/hacktivate-kit";
import { OWN_COMPONENTS_RULE } from "@/lib/track-pick";

describe("Hacktivate PCB Cupid kit hub", () => {
  it("points at the PCB Cupid Hacktivate event page", () => {
    expect(PCB_CUPID_HACKTIVATE_URL).toBe("https://events.pcbcupid.com/events/hacktivate/");
  });

  it("keeps the Arduino setup links PCB Cupid published", () => {
    expect(ARDUINO_IDE_INSTALL_URL).toBe("https://www.arduino.cc/en/software");
    expect(ARDUINO_IDE_PCBCUPID_SETUP_URL).toBe(
      "https://learn.pcbcupid.com/boards/needs/arduino-ide-setup",
    );
  });

  it("mentions the local kit page in the Track 1 components rule", () => {
    expect(OWN_COMPONENTS_RULE).toContain("/hacktivate/kit");
  });
});
