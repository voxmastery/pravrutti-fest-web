#!/usr/bin/env python3
"""Render public/hacktivate-rules.pdf from the current Hacktivate rules.

The previous file was a two-page brief with a 100-mark rubric and no
component rule. This is the replacement. Challenge PDFs are patched
separately; they are LibreOffice exports with no source in the repo.
"""

from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "hacktivate-rules.pdf"
REG = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"

NAVY = (31 / 255, 58 / 255, 100 / 255)
INK = (17 / 255, 17 / 255, 17 / 255)
MUTED = (68 / 255, 88 / 255, 106 / 255)

PAGE_W, PAGE_H = 595.0, 842.0
LEFT, RIGHT = 56.0, 540.0
WIDTH = RIGHT - LEFT
BOTTOM = 800.0


class Rules:
    def __init__(self) -> None:
        self.doc = pymupdf.open()
        self.regular = pymupdf.Font(fontfile=REG)
        self.bold = pymupdf.Font(fontfile=BOLD)
        self.page = None
        self.y = 0.0
        self.new_page()

    def new_page(self) -> None:
        self.page = self.doc.new_page(width=PAGE_W, height=PAGE_H)
        self.y = 48.0

    def ensure(self, height: float) -> None:
        if self.y + height > BOTTOM:
            self.new_page()

    def wrap(self, text: str, font: pymupdf.Font, size: float, width: float) -> list[str]:
        words = text.split()
        lines: list[str] = []
        cur = ""
        for word in words:
            trial = word if not cur else f"{cur} {word}"
            if font.text_length(trial, size) <= width:
                cur = trial
            else:
                if cur:
                    lines.append(cur)
                cur = word
        if cur:
            lines.append(cur)
        return lines or [""]

    def paragraph(
        self,
        text: str,
        *,
        size: float = 10.5,
        bold: bool = False,
        color: tuple[float, float, float] = INK,
        indent: float = 0.0,
        gap: float = 4.0,
        leading: float | None = None,
    ) -> None:
        font = self.bold if bold else self.regular
        lead = leading if leading is not None else size + 3.2
        width = WIDTH - indent
        lines = self.wrap(text, font, size, width)
        self.ensure(lead * len(lines) + gap)
        for line in lines:
            baseline = self.y + size
            self.page.insert_text(
                pymupdf.Point(LEFT + indent, baseline),
                line,
                fontfile=BOLD if bold else REG,
                fontsize=size,
                color=color,
            )
            self.y += lead
        self.y += gap

    def heading(self, text: str) -> None:
        self.y += 6
        self.paragraph(text, size=12.5, bold=True, color=NAVY, gap=6, leading=16)

    def item(self, text: str) -> None:
        self.paragraph(text, indent=14, gap=3.5)

    def rule_row(self, criterion: str, marks: str, *, bold: bool = False) -> None:
        size = 10.5
        lead = 16
        self.ensure(lead + 2)
        y = self.y + 12
        self.page.draw_line(pymupdf.Point(LEFT, self.y), pymupdf.Point(RIGHT, self.y), color=NAVY, width=0.4)
        fontfile = BOLD if bold else REG
        self.page.insert_text(pymupdf.Point(LEFT + 4, y), criterion, fontfile=fontfile, fontsize=size, color=INK)
        self.page.insert_text(pymupdf.Point(RIGHT - 36, y), marks, fontfile=fontfile, fontsize=size, color=INK)
        self.y += lead

    def save(self) -> None:
        self.doc.set_metadata(
            {
                "title": "Hacktivate — Event-Specific Rules & Regulations",
                "author": "IEEE Student Branch, RUAS Peenya Campus",
            }
        )
        self.doc.save(OUT, garbage=4, deflate=True)
        self.doc.close()


def main() -> None:
    doc = Rules()
    doc.paragraph("HACKTIVATE", size=22, bold=True, color=NAVY, gap=2, leading=26)
    doc.paragraph("24-Hour Predictive Systems Hackathon", size=12.5, bold=True, color=NAVY, gap=1, leading=16)
    doc.paragraph("IEEE Student Branch, RUAS Peenya Campus", size=10.5, color=MUTED, gap=2)
    doc.paragraph("Event-Specific Rules & Regulations", size=12, bold=True, color=NAVY, gap=8, leading=16)

    doc.heading("1. Eligibility and team composition")
    doc.item("1. The event is open to students from any college or university, across all branches and all years of study. Participants from outside RUAS are welcome.")
    doc.item("2. Teams must consist of a minimum of 2 and a maximum of 4 members. Individual entries are not permitted.")
    doc.item("3. A participant may be a member of only one Hacktivate team. Members cannot be exchanged between teams once registration closes.")
    doc.item("4. Each team must nominate one member as team lead, who serves as the point of contact for organiser communication during the event.")
    doc.item("5. All team members must be present at the venue for the full duration of the event.")

    doc.heading("2. Schedule")
    doc.item("1. The build window is 14 October 2026, 11:00 AM to 15 October 2026, 11:00 AM.")
    doc.item("2. Final judging is on 15 October 2026, 9:00 AM to 11:00 AM, inside that window.")
    doc.item("3. The code and hardware freeze applies when your team is called.")

    doc.heading("3. Theme and tracks")
    doc.item("1. All builds must address Predictive Systems: a working hardware and software system that senses real-world data and predicts an outcome or trend, such as failure, demand, anomaly, or an early-warning condition.")
    doc.item("2. Each team locks one track before the event. The three tracks are Seconds Ahead (Track 1), Voice That Sets People Free (Track 2, ElevenLabs x Seeed Studio), and Predict Anything (Track 3, open hardware). Within the chosen track, the team chooses its own application. The track pick is final.")
    doc.item("3. The team confirms that application with the organisers at the end of ideation. It may not be changed after the mid-hackathon checkpoint.")
    doc.item("4. Track 2 uses ElevenLabs voice. Voice is optional on Tracks 1 and 3. ElevenLabs credits are provided for every team.")

    doc.heading("4. Build rules")
    doc.item("1. The core of a team's submission must be designed and built live during the event. A team may not enter an existing project, or a modified version of one, as its primary work.")
    doc.item("2. Existing work a team has previously built may be used as a supporting piece - a library, module, utility, or boilerplate the team already owns. It must serve the new build, not constitute it. Teams must declare any such piece to the judges at demonstration.")
    doc.paragraph(
        "3. Teams may bring and use their own components. A PCB Cupid kit is available on site for Track 1 (Seconds Ahead).",
        size=10.5,
        bold=True,
        indent=14,
        gap=3.5,
    )
    doc.item("4. The Track 1 kit is optional. It is not a condition of entry, and teams are not limited to kit parts. Craft and mounting materials are fine on every track.")
    doc.item("5. Draw the schematic in KiCad, and simulate the sensing and hardware layer before assembly begins. The schematic should match the hardware on the table.")
    doc.item("6. Open-source libraries, public APIs, publicly available datasets, and ordinary development tools may be used freely. Use of AI coding assistants is permitted; teams should be prepared to explain any part of their submission when asked.")
    doc.item("7. Teams must bring their own laptops, with development environments pre-installed. Organisers provide power, connectivity, and workspace.")
    doc.item("8. Any design, code, or submission plagiarised from another team results in immediate disqualification of the entire team.")

    doc.heading("5. Phase checkpoints")
    doc.paragraph("The event runs in defined phases: ideation, design and simulation, build and sensor integration, predictive-layer integration, and final demonstration.")
    doc.item("• Each phase carries a guideline checkpoint. Teams significantly behind schedule may receive mentor support.")
    doc.item("• At the mid-hackathon checkpoint, every team gives a brief progress update to mentors and receives guidance for the overnight session.")

    doc.heading("6. Overnight conduct, meals, and safety")
    doc.item("1. Meals, overnight refreshments, and a supervised rest area are provided.")
    doc.item("2. Participants must remain within the designated venue for the full 24 hours. Sign-out is permitted only with organiser approval.")
    doc.item("3. Participants are strongly encouraged to rest in shifts overnight for their own safety and wellbeing.")
    doc.item("4. Soldering and assembly work must be carried out only at designated stations, observing all safety instructions given by organisers.")
    doc.item("5. Organiser supervision and security are maintained throughout the night. Participants must follow instructions from organisers and security staff at all times.")
    doc.item("6. First-aid provision is available for the full duration. Any injury or incident must be reported to organisers immediately.")
    doc.item("7. Damage to venue property or equipment is the responsibility of the participants concerned.")

    doc.heading("7. Submission and demonstration")
    doc.item("1. Judging is based on a live, powered-on demonstration at the table. Slide-only submissions are not accepted. A recording does not replace the live demonstration.")
    doc.item("2. Each team also records a short demo video of about 2 to 3 minutes during the hackathon, showing the product making its prediction and acting on it, and submits that video before 15 October 2026, 11:00 AM. The video is in addition to the live demo.")
    doc.item("3. A build that does not run live can still be scored on the other criteria and does not receive the live-demo marks.")
    doc.item("4. Each team has about five minutes at the table, followed by questions from the judges. Be ready when your team is called.")
    doc.item("5. Teams must submit their schematics, source code, and bill of materials to the organisers before demonstrations begin.")

    doc.heading("8. Judging")
    doc.paragraph("Six judges sit for the final, two per track. Each team has about five minutes at the table, then questions. The judges shortlist teams from that round. A combined final is then held before all six judges. Final judging is 15 October 2026, 9:00 AM to 11:00 AM.")
    doc.paragraph("Every track is judged on the same rubric, out of 20. Creativity is the tie-breaker. It does not add marks on top of 20.")
    doc.y += 4
    doc.rule_row("Criterion", "Marks", bold=True)
    doc.rule_row("KiCad design", "5")
    doc.rule_row("Hardware concept and working, including prediction quality", "7")
    doc.rule_row("User understanding", "3")
    doc.rule_row("Live demo", "5")
    doc.rule_row("Total", "20", bold=True)
    doc.page.draw_line(pymupdf.Point(LEFT, doc.y), pymupdf.Point(RIGHT, doc.y), color=NAVY, width=0.4)
    doc.y += 8
    doc.paragraph("Creativity is the tie-breaker when two teams finish on the same mark.")
    doc.paragraph("Judges' and organisers' decisions are final and binding in all matters.")

    doc.heading("9. Prizes")
    doc.item("1. The prize pool is Rs. 45,000, inclusive of GST: first place Rs. 20,000, second place Rs. 15,000, third place Rs. 10,000.")
    doc.item("2. Seeed Studio: Best Voice AI Build, a reSpeaker prize.")
    doc.item("3. ElevenLabs: every participant receives 1 month of ElevenLabs Creator, free. Each member of the overall winning team receives 3 months of ElevenLabs Pro. Each member of the best project built with ElevenLabs receives 3 months of ElevenLabs Scale.")

    doc.heading("10. General")
    doc.item("1. Participants are expected to conduct themselves respectfully towards fellow participants, volunteers, mentors, judges, and organisers at all times.")
    doc.item("2. Participants must comply with all applicable University and TechFest regulations throughout the event.")
    doc.item("3. Organisers reserve the right to disqualify any team for misconduct, plagiarism, unsafe practice, or breach of these rules.")
    doc.y += 8
    doc.paragraph("Organised by the IEEE Student Branch, RUAS Peenya Campus.", color=MUTED)

    doc.save()
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
