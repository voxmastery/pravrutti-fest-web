import { createHash, randomBytes } from "crypto";
import {
  DOCS_COPY,
  HACKTIVATE_DOC_MAX_BYTES,
  sanitizePdfFileName,
} from "@/lib/hacktivate-docs";

export function newDocId(): string {
  return randomBytes(8).toString("hex");
}

export function isPdfMagic(buf: Buffer): boolean {
  if (buf.length < 5) return false;
  return buf.subarray(0, 5).toString("ascii") === "%PDF-";
}

export type ValidatePdfResult =
  | { ok: true; fileName: string; size: number; contentBase64: string }
  | { ok: false; code: "empty" | "too_large" | "bad_type" | "bad_name"; message: string };

export function validatePdfUpload(opts: {
  fileName: string;
  bytes: Buffer;
}): ValidatePdfResult {
  const fileName = sanitizePdfFileName(opts.fileName);
  if (!fileName) return { ok: false, code: "bad_name", message: DOCS_COPY.badName };
  if (!opts.bytes.length) return { ok: false, code: "empty", message: DOCS_COPY.empty };
  if (opts.bytes.length > HACKTIVATE_DOC_MAX_BYTES) {
    return { ok: false, code: "too_large", message: DOCS_COPY.tooLarge };
  }
  if (!isPdfMagic(opts.bytes)) {
    return { ok: false, code: "bad_type", message: DOCS_COPY.badType };
  }
  return {
    ok: true,
    fileName,
    size: opts.bytes.length,
    contentBase64: opts.bytes.toString("base64"),
  };
}

export function contentFingerprint(contentBase64: string): string {
  return createHash("sha256").update(contentBase64).digest("hex").slice(0, 16);
}
