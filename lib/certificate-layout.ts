/**
 * Where the name sits on assets/certificates/pravrutti-2-template.png.
 *
 * The template is 1080×779. "THIS IS TO CERTIFY THAT" ends near y=318.
 * A hairline rule runs through y=433, and a diamond sits on that rule with
 * its top at y=426, centred at x=707. The name is centred on that diamond.
 * Its baseline is fixed from the preferred size so a shorter font (a long
 * name) still rests on the same line, and Times-Bold's descender stays a
 * few pixels above the diamond.
 */

export const TEMPLATE_PX = { width: 1080, height: 779 } as const;

/** A4 landscape, in PDF points. */
export const A4_LANDSCAPE = { width: 841.89, height: 595.28 } as const;

/** Times-Bold AFM: descender −217, ascender 683, per 1000. */
export const TIMES_BOLD_DESCENT = 217 / 1000;

export const NAME_LINE = {
  centerX: 707,
  diamondTop: 426,
  maxWidth: 500,
  preferredSize: 34,
  minSize: 12,
  /** Clear pixels between the lowest descender and the top of the diamond. */
  diamondGap: 5,
} as const;

/** Baseline in template pixels, measured from the top. Shared by every name. */
export function nameBaselinePx(): number {
  return (
    NAME_LINE.diamondTop -
    NAME_LINE.diamondGap -
    TIMES_BOLD_DESCENT * NAME_LINE.preferredSize
  );
}

/** Shrink until `widthAt(size)` fits the blank line. The baseline does not move. */
export function fitNameSize(widthAt: (size: number) => number): number {
  let size = NAME_LINE.preferredSize;
  while (size > NAME_LINE.minSize && widthAt(size) > NAME_LINE.maxWidth) {
    size = Math.round((size - 0.5) * 1000) / 1000;
  }
  return size;
}

export function nameOriginX(textWidthPx: number): number {
  return NAME_LINE.centerX - textWidthPx / 2;
}

/** Lowest y (from the top) a descender reaches at `size`. */
export function descenderBottomPx(size: number): number {
  return nameBaselinePx() + TIMES_BOLD_DESCENT * size;
}

export function fitTemplateRect(
  pageW: number,
  pageH: number,
  imgW: number,
  imgH: number,
): { x: number; y: number; w: number; h: number; scale: number } {
  const scale = Math.min(pageW / imgW, pageH / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  return { x: (pageW - w) / 2, y: (pageH - h) / 2, w, h, scale };
}

/** Template pixel (origin top-left) → PDF point (origin bottom-left) inside the fitted image. */
export function mapTemplatePoint(
  px: number,
  pyFromTop: number,
  image: { x: number; y: number; w: number; h: number },
  template: { width: number; height: number } = TEMPLATE_PX,
): { x: number; y: number } {
  return {
    x: image.x + (px / template.width) * image.w,
    y: image.y + image.h - (pyFromTop / template.height) * image.h,
  };
}

/** `Pravrutti2.0_Certificate_<Name>.pdf`, with the name made safe for a download. */
export function certificateFileName(fullName: string): string {
  const base = fullName
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return `Pravrutti2.0_Certificate_${base || "Participant"}.pdf`;
}

export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
