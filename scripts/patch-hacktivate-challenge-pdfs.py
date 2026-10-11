#!/usr/bin/env python3
"""Replace kit-only lines in the three Hacktivate challenge PDFs.

The files are LibreOffice exports. There is no Writer source in the repo,
so this edits the text in place and keeps the surrounding layout. Safe to
re-run: a line that no longer contains its old wording is skipped.
"""

from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[1]
REG = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
RULE = (
    "Teams may bring and use their own components. "
    "A PCB Cupid kit is available on site for Track 1 (Seconds Ahead)."
)
INK = (0, 0, 0)

# (path, page index, needle that must still be on the line, full replacement, right edge, bold)
# A needle of None is handled by the special cases below.
LINE_EDITS: list[tuple[str, int, str, str, float, bool]] = []


def rows(page: pymupdf.Page) -> list[dict]:
    found = []
    for block in page.get_text("dict")["blocks"]:
        if block.get("type") != 0:
            continue
        for line in block["lines"]:
            text = "".join(span["text"] for span in line["spans"])
            if not text.strip():
                continue
            spans = line["spans"]
            found.append(
                {
                    "text": text,
                    "x0": min(span["bbox"][0] for span in spans),
                    "y0": min(span["bbox"][1] for span in spans),
                    "x1": max(span["bbox"][2] for span in spans),
                    "y1": max(span["bbox"][3] for span in spans),
                    "origin": spans[0]["origin"][1],
                    "size": spans[0]["size"],
                    "bold": "Bold" in spans[0]["font"],
                }
            )
    return found


def wipe(page: pymupdf.Page, rect: pymupdf.Rect) -> None:
    page.add_redact_annot(rect, fill=(1, 1, 1))


def write_box(page: pymupdf.Page, rect: pymupdf.Rect, text: str, size: float, bold: bool, align: int = 0) -> float:
    return page.insert_textbox(
        rect,
        text,
        fontfile=BOLD if bold else REG,
        fontsize=size,
        color=INK,
        align=align,
    )


def wrap_words(font: pymupdf.Font, text: str, size: float, width: float) -> list[str]:
    lines: list[str] = []
    cur = ""
    for word in text.split():
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


def replace_lines(
    page: pymupdf.Page,
    needle: str,
    new: str,
    right: float,
    bold: bool | None,
    count: int = 1,
    before: int = 0,
    max_x0: float | None = None,
    grow: float = 14.0,
) -> str:
    """Replace lines by drawing on the same baselines. A tighter size is used
    only when the new words need a line the gap below cannot hold."""
    found = rows(page)
    if max_x0 is not None:
        found = [row for row in found if row["x0"] <= max_x0]
    hit = next((i for i, row in enumerate(found) if needle in row["text"]), None)
    if hit is None:
        return f"skip (already gone): {needle[:70]}"
    start = max(0, hit - before)
    group = found[start : hit + count]
    left = min(row["x0"] for row in group)
    top = min(row["y0"] for row in group) - 0.6
    text_bottom = max(row["y1"] for row in group)
    size = group[0]["size"]
    use_bold = group[0]["bold"] if bold is None else bold
    leading = size + 3.2
    if len(group) >= 2:
        leading = group[1]["origin"] - group[0]["origin"]
    next_origin = None
    for row in found:
        if row["origin"] <= group[-1]["origin"] + 0.5:
            continue
        if row["x1"] > left - 24 and row["x0"] < right - 8:
            next_origin = row["origin"]
            break
    # Keep the last baseline a full line above the next line, so a wrap cannot sit on it.
    floor = (next_origin - leading + 0.4) if next_origin is not None else group[-1]["origin"] + grow + leading
    font = pymupdf.Font(fontfile=BOLD if use_bold else REG)
    fontfile = BOLD if use_bold else REG
    width = right - left
    chosen: list[str] | None = None
    used = size
    for candidate in (size, size - 0.4, size - 0.8, size - 1.2):
        if candidate < 8:
            break
        wrapped = wrap_words(font, new, candidate, width)
        if len(wrapped) > len(group):
            continue
        last = group[0]["origin"] + leading * (len(wrapped) - 1)
        if last <= floor + 0.4:
            chosen = wrapped
            used = candidate
            break
    if chosen is None:
        return f"OVERFLOW lines: {needle[:50]}"
    wipe(page, pymupdf.Rect(left - 0.4, top, max(right, max(row["x1"] for row in group) + 1), text_bottom + 0.6))
    page.apply_redactions(images=0, graphics=0, text=0)
    for i, line in enumerate(chosen):
        page.insert_text(
            pymupdf.Point(left, group[0]["origin"] + leading * i),
            line,
            fontfile=fontfile,
            fontsize=used,
            color=INK,
        )
    return f"ok {used:.1f}pt/{len(chosen)}: {needle[:48]}"


def replace_span_of(
    page: pymupdf.Page,
    needle: str,
    new: str,
    right: float,
    extra_lines: int = 0,
    bold: bool | None = None,
    before: int = 0,
    max_x0: float | None = None,
) -> str:
    return replace_lines(
        page,
        needle,
        new,
        right,
        bold,
        count=1 + extra_lines,
        before=before,
        max_x0=max_x0,
    )


def main() -> None:
    notes: list[str] = []

    seconds = pymupdf.open(ROOT / "public/hacktivate/challenges/seconds-ahead.pdf")
    # Cover tagline sits in a white band with room for two lines under it.
    cover = seconds[0]
    cover_rows = rows(cover)
    tag = next((row for row in cover_rows if "build it with the PCB Cupid kit" in row["text"]), None)
    if tag:
        rect = pymupdf.Rect(70, tag["y0"] - 1, 525, tag["y0"] + 36)
        wipe(cover, pymupdf.Rect(tag["x0"] - 2, tag["y0"] - 1, tag["x1"] + 2, tag["y1"] + 1))
        cover.apply_redactions(images=0, graphics=0, text=0)
        spare = write_box(cover, rect, RULE, 10, False, align=1)
        notes.append(f"seconds cover {spare:.1f}")
    else:
        notes.append("seconds cover already updated")

    notes.append(
        replace_span_of(
            seconds[2],
            "build a product with the PCB Cupid kit",
            "Pick any problem that happens on the road, and build a product that predicts it before it happens.",
            530,
            extra_lines=1,
            bold=True,
        )
    )
    notes.append(
        replace_span_of(
            seconds[2],
            "Build with the PCB Cupid kit.",
            RULE + " The kit is not mandatory. Basic craft and mounting materials (cardboard, tape, foam, string, or a helmet, bag, handlebar or dashboard to mount it on) are fine.",
            534,
            extra_lines=3,
            bold=False,
        )
    )
    notes.append(
        replace_span_of(
            seconds[3],
            "runs on the kit's ESP32",
            "The board does the thinking. Your prediction runs on an ESP32. A phone or laptop may play",
            534,
            bold=True,
        )
    )
    notes.append(
        replace_span_of(
            seconds[3],
            "from the PCB Cupid kit.",
            "Most predictive road products are made of these four pieces. They describe the thinking; use your own parts, or parts from the PCB Cupid kit.",
            534,
            extra_lines=1,
        )
    )
    notes.append(
        replace_span_of(
            seconds[3],
            "the kit's sensors",
            "filling up, water rising, a time of day, a rider's habits, a spot's history. Capture them with sensors",
            534,
        )
    )
    # Stretch goal, if the wording is still the kit-only one.
    notes.append(
        replace_span_of(
            seconds[4],
            "Two kit boards",
            "Talks to other units. Two boards share what's ahead over BLE or Thread (ESP32-H2/C6).",
            534,
            bold=True,
        )
    )
    voice_line = next((row for row in rows(seconds[2]) if "Best Voice" in row["text"]), None)
    if voice_line:
        # The word "award." wraps onto the following line. Take both.
        following = rows(seconds[2])
        idx = next(i for i, row in enumerate(following) if "Best Voice" in row["text"])
        group_n = 2 if idx + 1 < len(following) and "award" in following[idx + 1]["text"].lower() else 1
        notes.append(
            replace_lines(
                seconds[2],
                "Best Voice",
                "Voice is optional for this challenge, but if you use ElevenLabs voice your team is eligible for the Best Voice AI Build (reSpeaker, from Seeed Studio).",
                534,
                False,
                count=group_n,
            )
        )
    else:
        notes.append("seconds Best Voice already updated")

    notes.append(
        replace_span_of(
            seconds[6],
            "Your Kit: PCB Cupid Components",
            "PCB Cupid kit, if you want it",
            530,
            bold=True,
        )
    )
    notes.append(
        replace_span_of(
            seconds[6],
            "products are built with these components",
            RULE + " The kit is optional.",
            534,
            extra_lines=1,
        )
    )
    notes.append(
        replace_span_of(
            seconds[6],
            "Not in the kit:",
            "Not in the kit: speaker, camera, motor or vibration motor, relay, GPS. You may bring those. Craft and mounting materials are fine.",
            534,
            extra_lines=1,
            bold=False,
        )
    )
    notes.append(
        replace_span_of(
            seconds[7],
            "Make the kit do the work",
            "- Let the hardware do the work. Sensors feed a prediction that runs on the ESP32, and its outputs (or a board-triggered voice) deliver the warning.",
            290,
            extra_lines=2,
            max_x0=200,
        )
    )
    notes.append(
        replace_span_of(
            seconds[7],
            "use the kit only for an LED",
            "the prediction, and use the board only for an LED.",
            520,
        )
    )
    notes.append(
        replace_span_of(
            seconds[8],
            "extra marks for creativity",
            "Every challenge is judged out of 20. Creativity is the tie-breaker.",
            534,
        )
    )
    notes.append(
        replace_span_of(
            seconds[8],
            "from PCB Cupid kit parts",
            "from your own parts or the kit.",
            530,
        )
    )
    notes.append(
        replace_span_of(
            seconds[8],
            "built with the kit",
            "product original, your parts or the kit, and does it act on the",
            530,
        )
    )
    notes.append(
        replace_span_of(
            seconds[8],
            "PCB Cupid kit plus craft",
            RULE,
            534,
            extra_lines=1,
            bold=False,
        )
    )
    notes.append(
        replace_span_of(
            seconds[8],
            "box of kit parts",
            "from parts you choose that sees the problem first and gets the warning to the right person in time, you",
            534,
        )
    )
    notes.append(
        replace_span_of(
            seconds[8],
            "Kit help desk:",
            "Kit help desk: a PCB Cupid kit is available on site for Track 1. Own components are allowed.",
            534,
        )
    )

    voice = pymupdf.open(ROOT / "public/hacktivate/challenges/voice-that-sets-people-free.pdf")
    notes.append(
        replace_span_of(
            voice[5],
            "kit is reserved",
            "Provided by organisers: ElevenLabs credits for every team. " + RULE,
            534,
            extra_lines=1,
            bold=False,
        )
    )
    notes.append(
        replace_span_of(
            voice[6],
            "extra marks for creativity",
            "Every challenge is judged out of 20. Creativity is the tie-breaker.",
            534,
        )
    )

    predict = pymupdf.open(ROOT / "public/hacktivate/challenges/predict-anything.pdf")
    notes.append(
        replace_span_of(
            predict[2],
            "beyond any shared kit",
            "Any hardware allowed. Any microcontroller, SBC, sensor or actuator you can run safely. " + RULE,
            534,
            before=1,
            bold=False,
        )
    )
    notes.append(
        replace_span_of(
            predict[4],
            "kit is reserved",
            RULE,
            534,
            extra_lines=1,
            bold=False,
        )
    )
    notes.append(
        replace_span_of(
            predict[5],
            "extra marks for creativity",
            "Every challenge is judged out of 20. Creativity is the tie-breaker.",
            534,
        )
    )

    for label, doc, name in (
        ("seconds", seconds, "seconds-ahead.pdf"),
        ("voice", voice, "voice-that-sets-people-free.pdf"),
        ("predict", predict, "predict-anything.pdf"),
    ):
        path = ROOT / "public/hacktivate/challenges" / name
        tmp = path.with_suffix(".pdf.tmp")
        doc.save(tmp, garbage=4, deflate=True)
        doc.close()
        tmp.replace(path)
        notes.append(f"wrote {name}")

    print("\n".join(notes))


if __name__ == "__main__":
    main()
