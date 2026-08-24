/**
 * Generates a placeholder poster per event into public/posters/.
 *
 * Every event needs cover art and none has been shot or designed yet. Rather
 * than ship 26 empty frames, this renders a branded card from data we already
 * have — category gradient, event name, sub-category, tier — so the site looks
 * finished while real artwork is produced.
 *
 * These are placeholders on purpose: replace any file with real artwork of the
 * same name and it is picked up with no code change. Re-running this script
 * will NOT overwrite a file unless --force is passed, so hand-made posters are
 * safe.
 *
 *   node scripts/generate-posters.mjs [--force]
 */
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "posters");
const force = process.argv.includes("--force");

const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Same gradients the UI uses, so a placeholder and its live cover agree.
const PALETTE = {
  "Engineering and Design": ["#721F4C", "#2B122C", "#0A0818"],
  "Research and Presentation": ["#BF8A1B", "#4A1C3A", "#0A0818"],
  "Code and Compute": ["#D64D8D", "#2B122C", "#0A0818"],
  "Enterprise and Expression": ["#4A1C3A", "#150B1E", "#0A0818"],
};
const ACCENT = {
  Visionary: "#F2D2AE",
  Creator: "#D64D8D",
  Explorer: "#F7EEE4",
};

const src = readFileSync(join(root, "lib", "pravrutti-data.ts"), "utf8");
const re =
  /name:\s*"([^"]+)",\s*\n\s*category:\s*"([^"]+)",\s*\n\s*subCategory:\s*"([^"]+)",[\s\S]*?type:\s*"([^"]+)"/g;

const events = [];
let m;
while ((m = re.exec(src))) {
  events.push({ slug: slug(m[1]), name: m[1], category: m[2], sub: m[3], type: m[4] });
}

mkdirSync(outDir, { recursive: true });

const payload = events
  .filter((e) => force || !existsSync(join(outDir, `${e.slug}.png`)))
  .map((e) => ({ ...e, colors: PALETTE[e.category] ?? PALETTE["Engineering and Design"], accent: ACCENT[e.type] ?? "#F7EEE4" }));

if (payload.length === 0) {
  console.log("All posters already exist. Pass --force to regenerate.");
  process.exit(0);
}

const py = `
import json, sys
from PIL import Image, ImageDraw, ImageFont

events = json.loads(sys.stdin.read())
OUT = ${JSON.stringify(outDir)}
S = 1000
H = 750   # 4:3 — card covers are landscape; square art would crop
FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

def hexr(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def wrap(draw, text, font, maxw):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=font) <= maxw:
            cur = t
        else:
            if cur: lines.append(cur)
            cur = w
    if cur: lines.append(cur)
    return lines

for e in events:
    c0, c1, c2 = [hexr(c) for c in e["colors"]]
    img = Image.new("RGB", (S, H), c2)
    d = ImageDraw.Draw(img)

    # Diagonal three-stop gradient. Built small and upscaled — a per-pixel
    # loop at 800x800 is 640k iterations per poster and visibly slow.
    N = 64
    small = Image.new("RGB", (N, N))
    sp = small.load()
    for yy in range(N):
        for xx in range(N):
            t = (xx / (N - 1) * 0.45 + yy / (N - 1) * 0.55)
            if t < 0.5:
                k = t / 0.5
                col = tuple(int(c0[i] + (c1[i] - c0[i]) * k) for i in range(3))
            else:
                k = (t - 0.5) / 0.5
                col = tuple(int(c1[i] + (c2[i] - c1[i]) * k) for i in range(3))
            sp[xx, yy] = col
    img = small.resize((S, H), Image.BICUBIC)
    d = ImageDraw.Draw(img)

    accent0 = hexr(e["accent"])

    # Oversized monogram fills the dead centre without competing with the
    # title — it reads as texture, not content.
    mono = "".join(w[0] for w in e["name"].split()[:2]).upper()
    mf = ImageFont.truetype(FB, 460)
    mw = d.textlength(mono, font=mf)
    layer = Image.new("RGBA", (S, H), (0, 0, 0, 0))
    ImageDraw.Draw(layer).text(((S - mw) / 2, H / 2 - 300), mono, font=mf, fill=accent0 + (26,))
    img = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")

    d = ImageDraw.Draw(img)

    # scanlines — the arcade texture used across the site
    sl = Image.new("RGBA", (S, H), (0, 0, 0, 0))
    dsl = ImageDraw.Draw(sl)
    for y in range(0, H, 4):
        dsl.line([(0, y), (S, y)], fill=(0, 0, 0, 46), width=1)
    img = Image.alpha_composite(img.convert("RGBA"), sl).convert("RGB")

    d = ImageDraw.Draw(img)
    accent = hexr(e["accent"])
    cream = (247, 238, 228)

    # corner rule
    d.rectangle([48, 48, 48 + 90, 52], fill=accent)

    # Kicker and sub-label stay cream, never the tier accent: background hue
    # is set by CATEGORY and accent by TIER, so accent-on-background pairings
    # like magenta-on-gold are unreadable. Cream is legible on all four.
    d.text((48, 76), "PRAVRUTTI 2026", font=ImageFont.truetype(FR, 20), fill=cream)
    d.text((48, 104), e["category"].upper(), font=ImageFont.truetype(FR, 17), fill=(247, 238, 228, 200))

    # Bottom-anchored block: scrim, title, sub-label, badge. Sized so a
    # three-line title cannot collide with what sits under it.
    BADGE_Y = H - 92
    SUB_Y = H - 128
    size = 72
    while size > 28:
        f = ImageFont.truetype(FB, size)
        lines = wrap(d, e["name"].upper(), f, S - 96)
        if len(lines) * (size + 8) <= 250: break
        size -= 6

    block_top = SUB_Y - 22 - len(lines) * (size + 8)

    # scrim keeps text readable over the lighter end of any gradient
    scrim = Image.new("RGBA", (S, H), (0, 0, 0, 0))
    ds = ImageDraw.Draw(scrim)
    for i in range(60):
        a = int(150 * (i / 60))
        ds.line([(0, block_top - 60 + i), (S, block_top - 60 + i)], fill=(10, 8, 24, a))
    ds.rectangle([0, block_top, S, H], fill=(10, 8, 24, 150))
    img = Image.alpha_composite(img.convert("RGBA"), scrim).convert("RGB")
    d = ImageDraw.Draw(img)

    y = block_top
    for ln in lines:
        d.text((48, y), ln, font=f, fill=cream)
        y += size + 8

    d.text((48, SUB_Y), e["sub"].upper(), font=ImageFont.truetype(FR, 19), fill=(247, 238, 228, 190))

    # tier badge, bottom-right, on its own dark chip so the accent reads
    tf = ImageFont.truetype(FB, 18)
    tw = d.textlength(e["type"].upper(), font=tf)
    d.rounded_rectangle([S - 48 - tw - 32, BADGE_Y, S - 48, BADGE_Y + 40], radius=20, fill=(10, 8, 24), outline=accent, width=2)
    d.text((S - 48 - tw - 16, BADGE_Y + 10), e["type"].upper(), font=tf, fill=accent)

    img.save(f"{OUT}/{e['slug']}.png", "PNG", optimize=True)
    print(e["slug"])
`;

const result = execFileSync("python3", ["-c", py], { input: JSON.stringify(payload), encoding: "utf8" });
console.log(result.trim());
console.log(`\nGenerated ${payload.length} poster(s) into public/posters/`);
