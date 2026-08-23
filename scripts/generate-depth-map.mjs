/**
 * Generates a grayscale depth map from a source image using Depth Anything V2
 * (via huggingface.js / @huggingface/transformers), running fully locally on CPU.
 *
 * The depth map is committed to `public/` and consumed at runtime as a Three.js
 * displacement texture, so no ML runtime is ever shipped to the browser.
 *
 * Usage:
 *   node scripts/generate-depth-map.mjs
 *   node scripts/generate-depth-map.mjs public/foo.png public/foo-depth.png
 *
 * Brighter pixel = nearer to camera. Darker = further away.
 */

import { pipeline, RawImage } from "@huggingface/transformers";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const MODEL_ID = "onnx-community/depth-anything-v2-small";
const DEFAULT_INPUT = "public/gate-temple.png";
const DEFAULT_OUTPUT = "public/gate-temple-depth.png";

async function main() {
  const [inputArg, outputArg] = process.argv.slice(2);
  const inputPath = resolve(process.cwd(), inputArg ?? DEFAULT_INPUT);
  const outputPath = resolve(process.cwd(), outputArg ?? DEFAULT_OUTPUT);

  if (!existsSync(inputPath)) {
    throw new Error(`Source image not found: ${inputPath}`);
  }

  console.log(`[depth] model   : ${MODEL_ID}`);
  console.log(`[depth] input   : ${inputPath}`);

  const estimator = await pipeline("depth-estimation", MODEL_ID, { dtype: "fp32" });

  const image = await RawImage.read(inputPath);
  console.log(`[depth] size    : ${image.width}x${image.height}`);

  const startedAt = Date.now();
  const { depth } = await estimator(image);
  console.log(`[depth] inferred: ${Date.now() - startedAt}ms`);

  if (depth.width !== image.width || depth.height !== image.height) {
    throw new Error(
      `Depth map ${depth.width}x${depth.height} does not match source ${image.width}x${image.height}; ` +
        `UVs would misalign.`,
    );
  }

  await depth.save(outputPath);
  console.log(`[depth] wrote   : ${outputPath}`);
}

main().catch((error) => {
  console.error("[depth] failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
