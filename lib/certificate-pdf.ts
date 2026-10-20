import "server-only";
import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import {
  A4_LANDSCAPE,
  TEMPLATE_PX,
  certificateFileName,
  fitNameSize,
  fitTemplateRect,
  mapTemplatePoint,
  nameBaselinePx,
  nameOriginX,
} from "@/lib/certificate-layout";

/** #6E1432, the maroon of the template titles. */
const NAME_COLOR = rgb(0x6e / 255, 0x14 / 255, 0x32 / 255);

export function certificateTemplatePath(): string {
  return path.join(process.cwd(), "assets", "certificates", "pravrutti-2-template.png");
}

/**
 * A4 landscape PDF of the participation template with `name` on the blank line.
 * The name is the only thing drawn on top of the artwork.
 */
export async function renderCertificatePdf(name: string): Promise<{ pdf: Uint8Array; filename: string }> {
  const png = await readFile(certificateTemplatePath());
  const doc = await PDFDocument.create();
  const page = doc.addPage([A4_LANDSCAPE.width, A4_LANDSCAPE.height]);
  const image = await doc.embedPng(png);
  const fitted = fitTemplateRect(A4_LANDSCAPE.width, A4_LANDSCAPE.height, image.width, image.height);
  page.drawImage(image, { x: fitted.x, y: fitted.y, width: fitted.w, height: fitted.h });

  const font = await doc.embedFont(StandardFonts.TimesRomanBold);
  const printable = winAnsiName(name, font);
  const scale = fitted.h / TEMPLATE_PX.height;
  const sizePx = fitNameSize((px) => font.widthOfTextAtSize(printable, px * scale) / scale);
  const widthPx = font.widthOfTextAtSize(printable, sizePx * scale) / scale;
  const origin = mapTemplatePoint(nameOriginX(widthPx), nameBaselinePx(), fitted);
  page.drawText(printable, {
    x: origin.x,
    y: origin.y,
    size: sizePx * scale,
    font,
    color: NAME_COLOR,
  });

  return { pdf: await doc.save(), filename: certificateFileName(name) };
}

/** Times-Bold is WinAnsi. Accented letters fold to their base form; anything else is dropped. */
function winAnsiName(name: string, font: PDFFont): string {
  const normalized = name.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (encodes(font, normalized)) return normalized;
  const folded = normalized.normalize("NFKD").replace(/\p{M}/gu, "");
  let out = "";
  for (const ch of folded) {
    if (encodes(font, ch)) out += ch;
    else if (/\s/.test(ch)) out += " ";
  }
  const cleaned = out.replace(/\s+/g, " ").trim();
  return cleaned.length >= 2 ? cleaned : "Participant";
}

function encodes(font: PDFFont, text: string): boolean {
  try {
    font.encodeText(text);
    return true;
  } catch {
    return false;
  }
}
