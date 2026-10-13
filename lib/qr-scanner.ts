/**
 * Fast ticket QR capture for the desk and organiser scanners.
 *
 * Prefer the browser's native BarcodeDetector (Chrome / Edge / Android) —
 * it uses the platform barcode stack and reads a QR in a few frames. Fall
 * back to ZXing with QR-only hints when the API is missing (Firefox, older
 * Safari). Both paths share the same camera stream, torch helper and
 * "don't fire twice" cooldown so the UI stays identical.
 */

import { BrowserQRCodeReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

export type QrScannerControls = {
  stop: () => void;
  switchTorch?: (on: boolean) => Promise<void>;
  engine: "barcode-detector" | "zxing";
};

type StartArgs = {
  video: HTMLVideoElement;
  facing: "environment" | "user";
  onCode: (text: string) => void;
  /** Ignore another decode of the same text for this long (ms). Default 900. */
  cooldownMs?: number;
};

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

function barcodeDetectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  return typeof Ctor === "function" ? Ctor : null;
}

/** True when this browser can run the fast native path. */
export function nativeQrSupported(): boolean {
  return barcodeDetectorCtor() !== null;
}

const CAMERA: MediaTrackConstraints = {
  /* 720p is enough for our short payloads and much cheaper to decode than 4K. */
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30, max: 30 },
};

function torchSwitcher(stream: MediaStream): ((on: boolean) => Promise<void>) | undefined {
  const track = stream.getVideoTracks()[0];
  if (!track) return undefined;
  const caps = track.getCapabilities?.() as { torch?: boolean } | undefined;
  if (!caps?.torch) return undefined;
  return async (on: boolean) => {
    await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
  };
}

function makeCooldown(ms: number) {
  let lastText = "";
  let lastAt = 0;
  return (text: string) => {
    const now = Date.now();
    if (text === lastText && now - lastAt < ms) return false;
    lastText = text;
    lastAt = now;
    return true;
  };
}

async function startNative(args: StartArgs, Ctor: BarcodeDetectorCtor): Promise<QrScannerControls> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: args.facing }, ...CAMERA },
  });
  const video = args.video;
  video.srcObject = stream;
  video.setAttribute("playsinline", "true");
  video.muted = true;
  await video.play();

  const detector = new Ctor({ formats: ["qr_code"] });
  const accept = makeCooldown(args.cooldownMs ?? 900);
  let alive = true;
  let inFlight = false;

  const tick = async () => {
    if (!alive) return;
    if (!inFlight && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      inFlight = true;
      try {
        const codes = await detector.detect(video);
        const text = codes[0]?.rawValue?.trim();
        if (text && accept(text)) args.onCode(text);
      } catch {
        /* A missed frame is fine — the next rAF tries again. */
      } finally {
        inFlight = false;
      }
    }
    if (alive) requestAnimationFrame(() => {
      void tick();
    });
  };
  requestAnimationFrame(() => {
    void tick();
  });

  return {
    engine: "barcode-detector",
    switchTorch: torchSwitcher(stream),
    stop: () => {
      alive = false;
      stream.getTracks().forEach((t) => t.stop());
      if (video.srcObject === stream) video.srcObject = null;
    },
  };
}

async function startZxing(args: StartArgs): Promise<QrScannerControls> {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
  hints.set(DecodeHintType.TRY_HARDER, false);
  const reader = new BrowserQRCodeReader(hints, {
    /* Default is already 0; keep it explicit so we never regress. */
    delayBetweenScanAttempts: 0,
    delayBetweenScanSuccess: args.cooldownMs ?? 900,
  });

  const accept = makeCooldown(args.cooldownMs ?? 900);
  const controls = await reader.decodeFromConstraints(
    { video: { facingMode: { ideal: args.facing }, ...CAMERA } },
    args.video,
    (res) => {
      if (!res) return;
      const text = res.getText()?.trim();
      if (text && accept(text)) args.onCode(text);
    },
  );

  const stream = args.video.srcObject instanceof MediaStream ? args.video.srcObject : null;
  return {
    engine: "zxing",
    switchTorch: stream ? torchSwitcher(stream) : undefined,
    stop: () => controls.stop(),
  };
}

/**
 * Open the camera and start decoding. Resolves once the stream is live.
 * Call `controls.stop()` on unmount or when flipping cameras.
 */
export async function startQrScanner(args: StartArgs): Promise<QrScannerControls> {
  const Native = barcodeDetectorCtor();
  if (Native) {
    try {
      return await startNative(args, Native);
    } catch {
      /* Permission or unsupported constraints — try ZXing before failing. */
    }
  }
  return startZxing(args);
}
