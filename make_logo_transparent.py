"""
Rebuild public/pravrutti-logo.png (transparent) from the clean source JPEG.

The previous version used a hard binary cutoff (`if r<20 and g<20 and b<20 -> fully
transparent, else fully opaque`). On a JPEG source that is fatal: compression noise
pushes scattered background pixels just above the threshold, so they survived as
fully-opaque near-black speckles, and every edge became a 1-bit jagged cutout. The
result looked pixelated everywhere the logo was used.

This version derives a *continuous* alpha from the pixel's brightness instead, which
is the correct transform for artwork drawn as light on a black field: alpha = max(r,g,b),
then un-premultiply the colour so soft glows stay soft and edges stay anti-aliased.
"""

import os
from PIL import Image

SRC = "public/pravrutti-logo.jpeg"
OUT = "public/pravrutti-logo.png"

# Brightness below this is treated as pure background (kills residual JPEG mud).
FLOOR = 8
# Brightness at/above this is treated as fully opaque.
CEIL = 235


def build(src_path: str, out_path: str) -> None:
    img = Image.open(src_path).convert("RGB")
    px = list(img.getdata())

    out = []
    for r, g, b in px:
        a = max(r, g, b)

        if a <= FLOOR:
            out.append((0, 0, 0, 0))
            continue

        # Ramp the very darkest tones down to zero so the field is genuinely clean
        # rather than a haze of alpha-1..8 noise.
        if a >= CEIL:
            alpha = 255
        else:
            alpha = int(round((a - FLOOR) * 255.0 / (CEIL - FLOOR)))
            alpha = max(0, min(255, alpha))

        if alpha == 0:
            out.append((0, 0, 0, 0))
            continue

        # Un-premultiply: recover the colour as if drawn at full opacity, so the
        # PNG composites correctly over any background instead of only over black.
        scale = 255.0 / a
        out.append((
            min(255, int(r * scale)),
            min(255, int(g * scale)),
            min(255, int(b * scale)),
            alpha,
        ))

    result = Image.new("RGBA", img.size)
    result.putdata(out)
    result.save(out_path, "PNG", optimize=True)

    print(f"{src_path} {img.size} -> {out_path} "
          f"({os.path.getsize(out_path) / 1024:.0f} KB)")


if __name__ == "__main__":
    build(SRC, OUT)
